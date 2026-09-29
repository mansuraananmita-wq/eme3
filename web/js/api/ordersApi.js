/**
 * Read-only order history for the signed-in customer.
 * Clients cannot insert or update orders (RLS / grants).
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
  const { data, error } = await supabase
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
    .eq("id", id)
    .eq("customer_id", profile.id)
    .maybeSingle();

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
