/**
 * Customer order history + vendor order lines.
 * Inserts go through place_order / cancel_my_order / vendor_set_item_status RPCs.
 */

import { getCurrentProfile } from "../auth.js";
import { getSupabase } from "../supabaseClient.js";

export const ORDERS_PAGE_SIZE = 10;

const ORDER_COLUMNS = `
  id, customer_id, status, payment_status, subtotal, shipping_fee, total, currency,
  shipping_address, source, source_id, created_at, updated_at
`;

const ITEM_COLUMNS = `
  id, order_id, product_id, vendor_id, title, unit_price, quantity, line_total,
  item_status, created_at, updated_at
`;

/** Allowed vendor item_status transitions (mirrors f6_item_status_allowed). */
export const ITEM_STATUS_NEXT = Object.freeze({
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
});

/**
 * @param {{ status?: string, limit?: number, offset?: number }} [filters]
 * @returns {Promise<{ rows: Array<object>, total: number }>}
 */
export async function listMyOrders(filters = {}) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to view orders.");

  const supabase = getSupabase();
  let query = supabase
    .from("orders")
    .select(`
      ${ORDER_COLUMNS},
      order_items (
        id, title, quantity, vendor_id, product_id,
        vendor_profiles ( shop_name, slug )
      )
    `, { count: "exact" })
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);

  const limit = filters.limit ?? ORDERS_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []).map(summarizeOrder),
    total: count ?? 0,
  };
}

/**
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function getMyOrder(id) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to view orders.");

  const supabase = getSupabase();
  let query = supabase
    .from("orders")
    .select(`
      ${ORDER_COLUMNS},
      order_items (
        ${ITEM_COLUMNS},
        vendor_profiles ( profile_id, shop_name, slug, logo_url ),
        products (
          id, slug, status,
          product_images ( storage_path, sort_order, is_primary )
        )
      ),
      payments (
        id, provider, provider_reference, amount, currency, status, created_at
      )
    `)
    .eq("id", id);

  if (profile.role !== "admin") query = query.eq("customer_id", profile.id);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    order_items: data.order_items || [],
    shops: groupItemsByShop(data.order_items || []),
    payments: data.payments || [],
  };
}

/**
 * Cancel own pending order via RPC (restores stock).
 * @param {string} orderId
 * @returns {Promise<void>}
 */
export async function cancelMyOrder(orderId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to cancel an order.");

  const supabase = getSupabase();
  const { error } = await supabase.rpc("cancel_my_order", { p_order_id: orderId });
  if (error) {
    console.error("cancel_my_order:", error);
    throw error;
  }
}

/**
 * Order lines for the signed-in approved vendor.
 * @param {{ itemStatus?: string, limit?: number, offset?: number }} [filters]
 * @returns {Promise<{ rows: Array<object>, total: number }>}
 */
export async function listVendorOrderItems(filters = {}) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage orders.");

  const supabase = getSupabase();
  let query = supabase
    .from("order_items")
    .select(`
      ${ITEM_COLUMNS},
      orders!inner (
        id, status, payment_status, total, currency, shipping_address, created_at, customer_id
      ),
      products ( id, slug, title )
    `, { count: "exact" })
    .eq("vendor_id", profile.id)
    .order("created_at", { ascending: false });

  if (filters.itemStatus) query = query.eq("item_status", filters.itemStatus);

  const limit = filters.limit ?? ORDERS_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []).map((row) => {
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      return { ...row, order };
    }),
    total: count ?? 0,
  };
}

/**
 * @param {string} itemId
 * @param {string} status
 * @returns {Promise<object>}
 */
export async function vendorSetItemStatus(itemId, status) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in required.");

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("vendor_set_item_status", {
    p_item_id: itemId,
    p_status: status,
  });
  if (error) {
    console.error("vendor_set_item_status:", error);
    throw error;
  }
  return data;
}

/**
 * @param {object} order
 * @returns {object}
 */
function summarizeOrder(order) {
  const items = order.order_items || [];
  const shopNames = [...new Set(
    items
      .map((item) => {
        const shop = item.vendor_profiles;
        const row = Array.isArray(shop) ? shop[0] : shop;
        return row?.shop_name || null;
      })
      .filter(Boolean),
  )];

  return {
    id: order.id,
    status: order.status,
    payment_status: order.payment_status,
    total: order.total,
    currency: order.currency,
    created_at: order.created_at,
    itemCount: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    shopNames,
  };
}

/**
 * @param {Array<object>} items
 * @returns {Array<{ shop: object | null, items: Array<object> }>}
 */
function groupItemsByShop(items) {
  /** @type {Map<string, { shop: object | null, items: Array<object> }>} */
  const map = new Map();

  for (const item of items) {
    const shopRaw = item.vendor_profiles;
    const shop = Array.isArray(shopRaw) ? shopRaw[0] : shopRaw;
    const key = item.vendor_id || shop?.slug || "unknown";
    if (!map.has(key)) map.set(key, { shop: shop || null, items: [] });
    map.get(key).items.push(item);
  }

  return [...map.values()];
}
