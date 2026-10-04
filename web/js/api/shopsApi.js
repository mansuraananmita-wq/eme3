import { getSupabase } from "../supabaseClient.js";
import { getCurrentProfile } from "../auth.js";

const SHOP_COLUMNS = `
  profile_id,
  shop_name,
  slug,
  description,
  logo_url,
  banner_url,
  status,
  followers_count,
  created_at
`;

/**
 * @param {string} value
 * @returns {string}
 */
function searchTerm(value) {
  return value.trim().replaceAll("%", "").replaceAll("_", "").replaceAll(",", " ");
}

/**
 * Turns a shop name into a URL slug that matches vendor_profiles_slug_format.
 * @param {string} name
 * @returns {string}
 */
export function slugifyShopName(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Approved shops, optionally filtered by name search.
 * @param {{ q?: string, limit?: number }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function listApprovedShops(options = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from("vendor_profiles")
    .select(`${SHOP_COLUMNS}, products(count)`)
    .eq("status", "approved")
    .order("shop_name", { ascending: true })
    .limit(options.limit ?? 48);

  const term = options.q ? searchTerm(options.q) : "";
  if (term) query = query.ilike("shop_name", `%${term}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeShop);
}

/**
 * Featured shops with a few product thumbnails for the home page.
 * @param {number} [limit]
 * @returns {Promise<Array<object>>}
 */
export async function listFeaturedShops(limit = 6) {
  return listShopsWithProducts({ limit, orderBy: "created_at", ascending: false });
}

/**
 * Top stores by follower count (schema has followers_count, not shop rating).
 * @param {number} [limit]
 * @returns {Promise<Array<object>>}
 */
export async function listTopShops(limit = 10) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vendor_profiles")
    .select(`${SHOP_COLUMNS}, products(count)`)
    .eq("status", "approved")
    .order("followers_count", { ascending: false })
    .order("shop_name", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(normalizeShop);
}

/**
 * @param {{ limit?: number, orderBy?: string, ascending?: boolean }} options
 * @returns {Promise<Array<object>>}
 */
async function listShopsWithProducts(options = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vendor_profiles")
    .select(`
      ${SHOP_COLUMNS},
      products (
        id,
        title,
        slug,
        status,
        product_images (
          storage_path,
          sort_order,
          is_primary
        )
      )
    `)
    .eq("status", "approved")
    .order(options.orderBy || "created_at", { ascending: options.ascending ?? false })
    .limit(options.limit ?? 6);

  if (error) throw error;

  return (data ?? []).map((shop) => {
    const active = (shop.products || []).filter((product) => product.status === "active");
    return {
      ...normalizeShop({ ...shop, products: [{ count: active.length }] }),
      products: active.slice(0, 4),
    };
  });
}

/**
 * One approved shop by id (profile_id) or slug.
 * @param {{ id?: string | null, slug?: string | null }} key
 * @returns {Promise<object | null>}
 */
export async function getShop(key) {
  const supabase = getSupabase();
  let query = supabase
    .from("vendor_profiles")
    .select(`${SHOP_COLUMNS}, products(count)`)
    .eq("status", "approved");

  if (key.id) query = query.eq("profile_id", key.id);
  else if (key.slug) query = query.eq("slug", key.slug);
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? normalizeShop(data) : null;
}

/**
 * Published reels for a shop. Empty array when the shop has none.
 * @param {string} vendorId
 * @returns {Promise<Array<object>>}
 */
export async function listShopReels(vendorId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reels")
    .select("id, caption, thumbnail_path, video_path, status, created_at")
    .eq("vendor_id", vendorId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) throw error;
  return data ?? [];
}

/**
 * Public live rooms for a shop (scheduled, live, ended).
 * @param {string} vendorId
 * @returns {Promise<Array<object>>}
 */
export async function listShopLives(vendorId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("live_streams")
    .select("id, title, thumbnail_url, status, scheduled_at, created_at")
    .eq("vendor_id", vendorId)
    .in("status", ["scheduled", "live", "ended"])
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) throw error;
  return data ?? [];
}

/**
 * The signed-in user's own shop application, if any.
 * @returns {Promise<object | null>}
 */
export async function getMyShopApplication() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vendor_profiles")
    .select(SHOP_COLUMNS)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Apply to sell. RLS allows insert only as pending with followers_count 0.
 * @param {{ shop_name: string, slug: string, description?: string, logo_url?: string, banner_url?: string }} input
 * @returns {Promise<object>}
 */
export async function applyAsVendor(input) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to apply as a seller.");

  const existing = await getMyShopApplication();
  if (existing) throw new Error("You already have a shop application.");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vendor_profiles")
    .insert({
      profile_id: profile.id,
      shop_name: input.shop_name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      banner_url: input.banner_url?.trim() || null,
    })
    .select(SHOP_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("That shop name or slug is already taken.");
    throw error;
  }
  return data;
}

/**
 * Commission percent from platform_settings, when present.
 * @returns {Promise<number | null>}
 */
export async function getCommissionPercent() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "commission_rate")
    .maybeSingle();

  if (error) throw error;
  const percent = Number(data?.value?.percent);
  return Number.isFinite(percent) ? percent : null;
}

/**
 * Shops the signed-in customer follows.
 * @returns {Promise<Array<object>>}
 */
export async function listFollowedShops() {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vendor_follows")
    .select("vendor_id, created_at, vendor_profiles(shop_name, slug, logo_url, followers_count, status)")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("list followed shops:", error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const shop = Array.isArray(row.vendor_profiles) ? row.vendor_profiles[0] : row.vendor_profiles;
    return {
      vendorId: row.vendor_id,
      shopName: shop?.shop_name || "Shop",
      slug: shop?.slug || "",
      logoUrl: shop?.logo_url || "",
      followers: shop?.followers_count ?? 0,
      status: shop?.status || "",
    };
  });
}

/**
 * @param {object} shop
 * @returns {object}
 */
function normalizeShop(shop) {
  const countRow = Array.isArray(shop.products) ? shop.products[0] : shop.products;
  const productCount = Number(countRow?.count ?? 0);
  return {
    profile_id: shop.profile_id,
    shop_name: shop.shop_name,
    slug: shop.slug,
    description: shop.description,
    logo_url: shop.logo_url,
    banner_url: shop.banner_url,
    status: shop.status,
    followers_count: shop.followers_count,
    created_at: shop.created_at,
    productCount,
  };
}
