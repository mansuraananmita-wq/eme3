/**
 * Checkout helpers and a PLACEHOLDER placeOrder that does not write to the database.
 * Orders / order_items / payments have no client insert policy.
 */

import { listCart } from "./cartApi.js";
import { getAddress } from "./addressApi.js";
import { getSupabase } from "../supabaseClient.js";
import { getCurrentProfile } from "../auth.js";

/**
 * UI-only payment method choices.
 * There is no payment_method enum in the schema; payments.provider is free text.
 * These values are for the future checkout RPC payload only.
 */
export const PAYMENT_METHODS = [
  { id: "cash_on_delivery", label: "Cash on delivery" },
  { id: "bkash", label: "bKash" },
  { id: "nagad", label: "Nagad" },
  { id: "card", label: "Card" },
];

/**
 * Default shipping fee from platform_settings (no shipping_methods table).
 * @returns {Promise<{ amount: number, currency: string }>}
 */
export async function getDefaultShippingFee() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "default_shipping_fee")
    .maybeSingle();

  if (error) throw error;
  const amount = Number(data?.value?.amount);
  const currency = typeof data?.value?.currency === "string" ? data.value.currency : "BDT";
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "BDT",
  };
}

/**
 * Builds a checkout summary from the live cart (billable lines only).
 * @returns {Promise<{
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

  const lines = (await listCart()).filter((line) => line.billable);
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
    lines,
    shops: [...groups.values()],
    subtotal,
    currency,
    empty: lines.length === 0,
  };
}

/**
 * PLACEHOLDER — does not insert into orders, order_items, or payments.
 * Validates the payload the future secure checkout function will need.
 *
 * @param {{
 *   addressId: string,
 *   paymentMethod: string,
 *   couponCode?: string | null
 * }} input
 * @returns {Promise<{ ok: true, payload: object, message: string }>}
 */
export async function placeOrder(input) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to place an order.");

  const addressId = String(input.addressId || "").trim();
  if (!addressId) throw new Error("Choose a delivery address.");

  const paymentMethod = String(input.paymentMethod || "").trim();
  if (!PAYMENT_METHODS.some((method) => method.id === paymentMethod)) {
    throw new Error("Choose a payment method.");
  }

  // No coupons table in the schema — ignore any coupon field.

  const address = await getAddress(addressId);
  if (!address) throw new Error("That address is not available.");

  const summary = await buildCheckoutSummary();
  if (summary.empty) throw new Error("Your cart is empty.");

  const shipping = await getDefaultShippingFee();
  const shippingFee = shipping.amount;
  const total = summary.subtotal + shippingFee;

  const payload = {
    customer_id: profile.id,
    address_id: address.id,
    shipping_address: {
      label: address.label,
      recipient_name: address.recipient_name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      district: address.district,
      postal_code: address.postal_code,
    },
    payment_method: paymentMethod,
    currency: summary.currency,
    subtotal: summary.subtotal,
    shipping_fee: shippingFee,
    total,
    source: "direct",
    shops: summary.shops.map((shop) => ({
      shop_name: shop.shopName,
      shop_slug: shop.shopSlug,
      subtotal: shop.subtotal,
      items: shop.lines.map((line) => ({
        product_id: line.productId,
        title: line.product?.title,
        unit_price: line.unitPrice,
        quantity: Math.min(line.quantity, line.stock),
        line_total: line.lineTotal,
        vendor_hint: line.shopSlug,
      })),
    })),
  };

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    // Development only — inspect the payload that a future RPC will receive.
    console.info("[EME checkout placeholder] placeOrder payload", payload);
  }

  // FUTURE: call a secure Supabase RPC or Edge Function here, for example:
  //   const { data, error } = await getSupabase().rpc("place_order", { payload });
  //   or: await getSupabase().functions.invoke("checkout", { body: payload });
  // Do not insert into public.orders / order_items / payments from the browser.

  return {
    ok: true,
    payload,
    message: "Order placement will be enabled after the secure order function is added.",
  };
}
