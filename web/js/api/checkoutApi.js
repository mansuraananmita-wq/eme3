/**
 * Checkout helpers and secure place_order RPC (anon/authenticated client only).
 * Prices and stock are verified server-side — never trust browser totals.
 */

import { listCart } from "./cartApi.js";
import { getAddress } from "./addressApi.js";
import { getProduct } from "./productsApi.js";
import { getSupabase } from "../supabaseClient.js";
import { getCurrentProfile } from "../auth.js?v=3";
import { notifyCounts } from "./notify.js";

const BUY_NOW_KEY = "eme-buy-now";

/**
 * Delivery fee rule (must match public.f6_shipping_fee in supabase/f6_orders.sql).
 * Dhaka (city or district contains "dhaka"): inside; otherwise outside.
 */
export const DELIVERY_FEES = Object.freeze({
  currency: "BDT",
  insideDhaka: 60,
  outsideDhaka: 120,
});

/**
 * UI payment methods. Only cash_on_delivery is accepted by place_order today.
 */
export const PAYMENT_METHODS = [
  { id: "cash_on_delivery", label: "Cash on delivery / ক্যাশ অন ডেলিভারি", available: true },
];

/**
 * @param {{ city?: string, district?: string } | null | undefined} address
 * @returns {{ amount: number, currency: string, zone: "dhaka" | "outside" }}
 */
export function shippingFeeForAddress(address) {
  const city = String(address?.city || "").toLowerCase();
  const district = String(address?.district || "").toLowerCase();
  const dhaka = city.includes("dhaka") || district.includes("dhaka");
  return {
    amount: dhaka ? DELIVERY_FEES.insideDhaka : DELIVERY_FEES.outsideDhaka,
    currency: DELIVERY_FEES.currency,
    zone: dhaka ? "dhaka" : "outside",
  };
}

/**
 * @deprecated Prefer shippingFeeForAddress — kept for callers that need a default before an address is chosen.
 * @returns {Promise<{ amount: number, currency: string }>}
 */
export async function getDefaultShippingFee() {
  return {
    amount: DELIVERY_FEES.insideDhaka,
    currency: DELIVERY_FEES.currency,
  };
}

/**
 * @param {string} productId
 * @param {number} [quantity]
 */
export function setBuyNow(productId, quantity = 1) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify({ productId, quantity: qty }));
}

/** Clears buy-now checkout mode. */
export function clearBuyNow() {
  sessionStorage.removeItem(BUY_NOW_KEY);
}

/**
 * @returns {{ productId: string, quantity: number } | null}
 */
export function getBuyNow() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(BUY_NOW_KEY) || "null");
    if (!raw?.productId) return null;
    return {
      productId: String(raw.productId),
      quantity: Math.max(1, Math.floor(Number(raw.quantity) || 1)),
    };
  } catch {
    return null;
  }
}

/**
 * Builds a checkout summary from buy-now or the live cart (billable lines only).
 * @returns {Promise<{
 *   mode: "cart" | "buy_now",
 *   buyNow: { productId: string, quantity: number } | null,
 *   lines: Array<object>,
 *   shops: Array<{ shopName: string, shopSlug: string | null, shopLogo: string | null, lines: Array<object>, subtotal: number, currency: string }>,
 *   subtotal: number,
 *   currency: string,
 *   empty: boolean
 * }>}
 */
export async function buildCheckoutSummary() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to check out.");

  const buyNow = getBuyNow();
  /** @type {Array<object>} */
  let lines = [];

  if (buyNow) {
    const product = await getProduct({ id: buyNow.productId });
    if (!product) throw new Error("That product is not available.");
    const stock = Number(product.stock) || 0;
    const qty = Math.min(buyNow.quantity, Math.max(1, stock));
    const shopRaw = product.vendor_profiles;
    const shop = Array.isArray(shopRaw) ? shopRaw[0] : shopRaw;
    const unitPrice = Number(product.price);
    const active = product.status === "active" && shop?.status === "approved" && stock > 0;
    if (!active) throw new Error("That product is not available.");
    lines = [
      {
        productId: product.id,
        quantity: qty,
        product,
        shopName: shop?.shop_name || "Shop",
        shopSlug: shop?.slug || null,
        shopLogo: shop?.logo_url || null,
        unitPrice,
        currency: product.currency || "BDT",
        lineTotal: unitPrice * qty,
        stock,
        warnings: [],
        billable: true,
      },
    ];
  } else {
    lines = (await listCart()).filter((line) => line.billable);
  }

  /** @type {Map<string, { shopName: string, shopSlug: string | null, shopLogo: string | null, lines: Array<object>, subtotal: number, currency: string }>} */
  const groups = new Map();
  let subtotal = 0;
  let currency = "BDT";

  for (const line of lines) {
    const key = line.shopSlug || line.shopName || "shop";
    if (!groups.has(key)) {
      groups.set(key, {
        shopName: line.shopName || "Shop",
        shopSlug: line.shopSlug || null,
        shopLogo: line.shopLogo || null,
        lines: [],
        subtotal: 0,
        currency: line.currency || "BDT",
      });
    }
    const group = groups.get(key);
    group.lines.push(line);
    group.subtotal += line.lineTotal;
    group.currency = line.currency || group.currency;
    subtotal += line.lineTotal;
    currency = line.currency || currency;
  }

  return {
    mode: buyNow ? "buy_now" : "cart",
    buyNow,
    lines,
    shops: [...groups.values()],
    subtotal,
    currency,
    empty: lines.length === 0,
  };
}

/**
 * Places an order via security-definer RPC. COD only.
 *
 * @param {{
 *   addressId: string,
 *   paymentMethod: string,
 *   source?: "direct" | "reel" | "live",
 *   sourceId?: string | null
 * }} input
 * @returns {Promise<{ orderId: string }>}
 */
export async function placeOrder(input) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to place an order.");

  const addressId = String(input.addressId || "").trim();
  if (!addressId) throw new Error("Choose a delivery address.");

  const paymentMethod = String(input.paymentMethod || "").trim();
  const method = PAYMENT_METHODS.find((row) => row.id === paymentMethod);
  if (!method) throw new Error("Choose a payment method.");
  if (!method.available) throw new Error("Choose cash on delivery.");

  const address = await getAddress(addressId);
  if (!address) throw new Error("That address is not available.");

  const summary = await buildCheckoutSummary();
  if (summary.empty) throw new Error("Your cart is empty.");

  const supabase = getSupabase();
  const args = {
    p_address_id: addressId,
    p_payment_method: paymentMethod,
    p_product_id: summary.buyNow?.productId || null,
    p_quantity: summary.buyNow?.quantity || null,
    p_source: input.source || "direct",
    p_source_id: input.sourceId || null,
  };

  const { data, error } = await supabase.rpc("place_order", args);
  if (error) {
    console.error("place_order RPC:", error);
    throw error;
  }

  const orderId = data?.order_id || data?.orderId;
  if (!orderId) {
    console.error("place_order returned unexpected payload:", data);
    throw new Error("Order was not created. Try again.");
  }

  clearBuyNow();
  try {
    await notifyCounts();
  } catch (notifyError) {
    console.error("notifyCounts after order:", notifyError);
  }

  return { orderId: String(orderId) };
}
