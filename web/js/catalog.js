import { getSupabase } from "./supabaseClient.js";

/**
 * Active categories. RLS already hides inactive rows from shoppers.
 * @returns {Promise<Array<{
 *   id: string,
 *   parent_id: string | null,
 *   name: string,
 *   slug: string,
 *   image_url: string | null,
 *   sort_order: number
 * }>>}
 */
export async function fetchActiveCategories() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, name, slug, image_url, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Active products whose shop is approved, with the first images and shop name.
 * @param {string} [search]
 * @returns {Promise<Array<object>>}
 */
export async function fetchActiveProducts(search = "") {
  const supabase = getSupabase();
  let query = supabase
    .from("products")
    .select(`
      id,
      title,
      slug,
      price,
      compare_at_price,
      currency,
      avg_rating,
      status,
      vendor_profiles!inner (
        shop_name,
        slug,
        status
      ),
      product_images (
        storage_path,
        sort_order,
        is_primary
      )
    `)
    .eq("status", "active")
    .eq("vendor_profiles.status", "approved")
    .order("created_at", { ascending: false })
    .limit(24);

  const term = search.trim().replaceAll("%", "").replaceAll("_", "");
  if (term) {
    query = query.ilike("title", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Cart and wishlist counts for the signed-in customer. Guests get zeros.
 * Both tables are readable only for the owner's rows.
 * @param {string | null} userId
 * @returns {Promise<{ cart: number, wishlist: number }>}
 */
export async function fetchBadgeCounts(userId) {
  if (!userId) return { cart: 0, wishlist: 0 };

  const supabase = getSupabase();
  const [cart, wishlist] = await Promise.all([
    supabase
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", userId),
    supabase
      .from("wishlist_items")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", userId),
  ]);

  if (cart.error) throw cart.error;
  if (wishlist.error) throw wishlist.error;

  return {
    cart: cart.count ?? 0,
    wishlist: wishlist.count ?? 0,
  };
}
