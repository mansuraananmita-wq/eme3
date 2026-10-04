import { addToCart } from "./cartApi.js";
import { notifyCounts } from "./notify.js";
import { getCurrentProfile } from "../auth.js?v=3";
import { getSupabase } from "../supabaseClient.js";

/**
 * @param {unknown} error
 * @returns {Error}
 */
function asError(error) {
  if (error instanceof Error) return error;
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "23505") return new Error("Already in your wishlist.");
  if (code === "23503") return new Error("This product is not available.");
  if (code === "42501") return new Error("Sign in to save products.");
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return new Error(message || "Could not update your wishlist.");
}

/**
 * @param {string | null} userId
 * @returns {Promise<number>}
 */
export async function wishlistCount(userId) {
  if (!userId) return 0;

  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("wishlist_items")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", userId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * @returns {Promise<Set<string>>}
 */
export async function wishlistIds() {
  const profile = await getCurrentProfile();
  if (!profile) return new Set();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("customer_id", profile.id);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.product_id));
}

/**
 * @returns {Promise<Array<{ id: string, productId: string, product: object | null }>>}
 */
export async function listWishlist() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select(`
      id,
      product_id,
      created_at,
      products (
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
      )
    `)
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    product: row.products && !Array.isArray(row.products) ? row.products : row.products?.[0] || null,
  }));
}

/**
 * @param {string} productId
 * @returns {Promise<void>}
 */
export async function addWishlist(productId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to save products.");

  const supabase = getSupabase();
  const { error } = await supabase.from("wishlist_items").insert({
    customer_id: profile.id,
    product_id: productId,
  });

  if (error) throw asError(error);
  notifyCounts();
}

/**
 * @param {string} productId
 * @returns {Promise<void>}
 */
export async function removeWishlist(productId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to change your wishlist.");

  const supabase = getSupabase();
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("customer_id", profile.id)
    .eq("product_id", productId);

  if (error) throw asError(error);
  notifyCounts();
}

/**
 * Saves the product in the cart, then removes the wishlist row.
 * @param {string} productId
 * @returns {Promise<{ capped: boolean, stock: number }>}
 */
export async function moveWishlistToCart(productId) {
  const result = await addToCart(productId, 1);
  await removeWishlist(productId);
  return result;
}
