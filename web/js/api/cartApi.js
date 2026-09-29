import { notifyCounts } from "./notify.js";
import { getProduct } from "./productsApi.js";
import { getCurrentProfile } from "../auth.js";
import { getSupabase } from "../supabaseClient.js";

const GUEST_KEY = "eme-guest-cart";

/**
 * @typedef {{ product_id: string, quantity: number }} GuestLine
 */

/**
 * @param {unknown} error
 * @returns {Error}
 */
function asError(error) {
  if (error instanceof Error) return error;
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "23503") return new Error("This product is not available.");
  if (code === "42501") return new Error("You do not have permission to change this cart.");
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return new Error(message || "Could not update the cart.");
}

/**
 * @returns {GuestLine[]}
 */
export function readGuestCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const totals = new Map();
    for (const row of raw) {
      const productId = String(row?.product_id || "");
      const quantity = Math.floor(Number(row?.quantity));
      if (!productId || quantity < 1) continue;
      totals.set(productId, (totals.get(productId) || 0) + quantity);
    }
    return [...totals.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
  } catch {
    return [];
  }
}

/**
 * @param {GuestLine[]} rows
 */
function writeGuestCart(rows) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(rows));
}

/**
 * @param {string | null} userId
 * @returns {Promise<number>}
 */
export async function cartCount(userId) {
  if (!userId) return readGuestCart().length;

  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", userId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Caps a requested quantity at the product's stock.
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<{ quantity: number, capped: boolean, stock: number }>}
 */
async function limitToStock(productId, quantity) {
  const product = await getProduct({ id: productId });
  if (!product) throw new Error("This product is not available.");
  const stock = Number(product.stock) || 0;
  if (stock < 1) throw new Error("This product is out of stock.");
  const next = Math.max(1, Math.floor(quantity));
  if (next > stock) return { quantity: stock, capped: true, stock };
  return { quantity: next, capped: false, stock };
}

/**
 * Adds a product, summing quantity when it is already in the cart.
 * @param {string} productId
 * @param {number} [add]
 * @returns {Promise<{ capped: boolean, stock: number }>}
 */
export async function addToCart(productId, add = 1) {
  const profile = await getCurrentProfile();
  const adding = Math.max(1, Math.floor(add));

  if (!profile) {
    const rows = readGuestCart();
    const current = rows.find((row) => row.product_id === productId)?.quantity || 0;
    const limited = await limitToStock(productId, current + adding);
    const next = rows.filter((row) => row.product_id !== productId);
    next.push({ product_id: productId, quantity: limited.quantity });
    writeGuestCart(next);
    notifyCounts();
    return { capped: limited.capped, stock: limited.stock };
  }

  const supabase = getSupabase();
  const existing = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("customer_id", profile.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing.error) throw asError(existing.error);

  const current = existing.data?.quantity || 0;
  const limited = await limitToStock(productId, current + adding);

  if (existing.data) {
    const updated = await supabase
      .from("cart_items")
      .update({ quantity: limited.quantity })
      .eq("id", existing.data.id)
      .eq("customer_id", profile.id);
    if (updated.error) throw asError(updated.error);
  } else {
    const inserted = await supabase.from("cart_items").insert({
      customer_id: profile.id,
      product_id: productId,
      quantity: limited.quantity,
    });
    if (inserted.error) throw asError(inserted.error);
  }

  notifyCounts();
  return { capped: limited.capped, stock: limited.stock };
}

/**
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<{ capped: boolean, stock: number } | null>}
 */
export async function setCartQuantity(productId, quantity) {
  const next = Math.floor(Number(quantity));
  if (next < 1) {
    await removeFromCart(productId);
    return null;
  }

  const profile = await getCurrentProfile();
  const limited = await limitToStock(productId, next);

  if (!profile) {
    const rows = readGuestCart().filter((row) => row.product_id !== productId);
    rows.push({ product_id: productId, quantity: limited.quantity });
    writeGuestCart(rows);
    notifyCounts();
    return { capped: limited.capped, stock: limited.stock };
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: limited.quantity })
    .eq("customer_id", profile.id)
    .eq("product_id", productId);

  if (error) throw asError(error);
  notifyCounts();
  return { capped: limited.capped, stock: limited.stock };
}

/**
 * @param {string} productId
 * @returns {Promise<void>}
 */
export async function removeFromCart(productId) {
  const profile = await getCurrentProfile();
  if (!profile) {
    writeGuestCart(readGuestCart().filter((row) => row.product_id !== productId));
    notifyCounts();
    return;
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("customer_id", profile.id)
    .eq("product_id", productId);

  if (error) throw asError(error);
  notifyCounts();
}

/**
 * Loads cart lines with product, shop, price, and stock.
 * Missing or inactive products stay in the list with a warning.
 * @returns {Promise<Array<object>>}
 */
export async function listCart() {
  const profile = await getCurrentProfile();
  if (!profile) return enrich(readGuestCart());

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, product_id, quantity, created_at")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return enrich((data ?? []).map((row) => ({
    product_id: row.product_id,
    quantity: row.quantity,
  })));
}

/** @type {Promise<boolean> | null} */
let mergeTask = null;

/**
 * Copies the guest cart into cart_items and clears localStorage.
 * Matching products have their quantities added together.
 * @param {string} [userId]
 * @returns {Promise<boolean>}
 */
export function mergeGuestCart(userId) {
  if (!readGuestCart().length) return Promise.resolve(false);
  if (!mergeTask) {
    mergeTask = mergeGuestCartNow(userId).finally(() => {
      mergeTask = null;
    });
  }
  return mergeTask;
}

/**
 * @param {string | undefined} userId
 * @returns {Promise<boolean>}
 */
async function mergeGuestCartNow(userId) {
  const guest = readGuestCart();
  if (!guest.length) return false;

  const profileId = userId || (await getCurrentProfile())?.id;
  if (!profileId) return false;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, product_id, quantity")
    .eq("customer_id", profileId);

  if (error) throw asError(error);

  const existing = new Map((data ?? []).map((row) => [row.product_id, row]));
  let pending = [...guest];

  for (const line of guest) {
    const found = existing.get(line.product_id);
    if (found) {
      const updated = await supabase
        .from("cart_items")
        .update({ quantity: found.quantity + line.quantity })
        .eq("id", found.id)
        .eq("customer_id", profileId);
      if (updated.error) throw asError(updated.error);
    } else {
      const inserted = await supabase.from("cart_items").insert({
        customer_id: profileId,
        product_id: line.product_id,
        quantity: line.quantity,
      });
      if (inserted.error && inserted.error.code !== "23503") throw asError(inserted.error);
    }

    pending = pending.filter((row) => row.product_id !== line.product_id);
    writeGuestCart(pending);
  }

  notifyCounts();
  return true;
}

/**
 * @param {GuestLine[]} lines
 * @returns {Promise<Array<object>>}
 */
async function enrich(lines) {
  if (!lines.length) return [];

  const supabase = getSupabase();
  const ids = lines.map((line) => line.product_id);
  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      title,
      slug,
      price,
      compare_at_price,
      currency,
      stock,
      status,
      vendor_profiles (
        shop_name,
        slug,
        logo_url,
        status
      ),
      product_images (
        storage_path,
        sort_order,
        is_primary
      )
    `)
    .in("id", ids);

  if (error) throw error;
  const byId = new Map((data ?? []).map((product) => [product.id, product]));

  return lines.map((line) => {
    const product = byId.get(line.product_id) || null;
    const shop = shopOf(product);
    const stock = product ? Number(product.stock) || 0 : 0;
    const active = Boolean(product && product.status === "active" && shop.status === "approved");
    const warnings = [];

    if (!product) warnings.push("This product is no longer available.");
    else if (!active) warnings.push("This product is not available from an approved shop.");
    else if (stock < 1) warnings.push("Out of stock.");
    else if (line.quantity > stock) warnings.push(`Only ${stock} in stock.`);

    const unitPrice = product ? Number(product.price) : null;
    const priced = active && unitPrice != null && stock > 0;
    const billableQty = priced ? Math.min(line.quantity, stock) : 0;

    return {
      productId: line.product_id,
      quantity: line.quantity,
      product,
      shopName: shop.name,
      shopSlug: shop.slug,
      shopLogo: shop.logo_url,
      unitPrice,
      currency: product?.currency || "BDT",
      lineTotal: priced ? unitPrice * billableQty : 0,
      stock,
      warnings,
      billable: priced,
    };
  });
}

/**
 * @param {object | null} product
 * @returns {{ name: string, slug: string | null, status: string | null }}
 */
function shopOf(product) {
  const shop = product?.vendor_profiles;
  const row = Array.isArray(shop) ? shop[0] : shop;
  return {
    name: row?.shop_name || "Unavailable",
    slug: row?.slug || null,
    status: row?.status || null,
    logo_url: row?.logo_url || null,
  };
}
