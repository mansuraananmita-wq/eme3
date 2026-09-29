/**
 * Public reels feed and engagement.
 * Clients cannot write views_count / shares_count (trigger-guarded).
 */

import { getCurrentProfile } from "../auth.js";
import { getSupabase } from "../supabaseClient.js";
import { pickProductImage, productImageUrl } from "../media.js";

export const REELS_PAGE_SIZE = 8;

const REEL_COLUMNS = `
  id,
  vendor_id,
  caption,
  video_path,
  thumbnail_path,
  duration_seconds,
  status,
  views_count,
  likes_count,
  comments_count,
  saves_count,
  created_at
`;

/**
 * Resolves reel video_path / thumbnail_path (full URL or Storage path).
 * @param {string | null | undefined} path
 * @param {"reel-videos" | "reel-thumbnails"} bucket
 * @returns {string}
 */
export function reelMediaUrl(path, bucket) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = getSupabase().storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

/**
 * Published reels from approved shops, with shop + tagged products.
 * @param {{ limit?: number, offset?: number, sort?: "newest" | "viewed", startAfter?: string | null }} [options]
 * @returns {Promise<{ rows: Array<object>, total: number }>}
 */
export async function listPublishedReels(options = {}) {
  const supabase = getSupabase();
  const limit = options.limit ?? REELS_PAGE_SIZE;
  const offset = options.offset ?? 0;

  let query = supabase
    .from("reels")
    .select(`
      ${REEL_COLUMNS},
      vendor_profiles!inner (
        profile_id,
        shop_name,
        slug,
        logo_url,
        status
      ),
      reel_products (
        sort_order,
        product_id,
        products (
          id,
          title,
          slug,
          price,
          compare_at_price,
          currency,
          stock,
          status,
          product_images (
            storage_path,
            sort_order,
            is_primary
          )
        )
      )
    `, { count: "exact" })
    .eq("status", "published")
    .eq("vendor_profiles.status", "approved");

  if (options.sort === "viewed") {
    query = query.order("views_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []).map(normalizeReel),
    total: count ?? 0,
  };
}

/**
 * One published reel by id.
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function getReel(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reels")
    .select(`
      ${REEL_COLUMNS},
      vendor_profiles!inner (
        profile_id,
        shop_name,
        slug,
        logo_url,
        status
      ),
      reel_products (
        sort_order,
        product_id,
        products (
          id,
          title,
          slug,
          price,
          compare_at_price,
          currency,
          stock,
          status,
          product_images (
            storage_path,
            sort_order,
            is_primary
          )
        )
      )
    `)
    .eq("id", id)
    .eq("status", "published")
    .eq("vendor_profiles.status", "approved")
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeReel(data) : null;
}

/**
 * Whether the signed-in user liked these reels.
 * @param {string[]} reelIds
 * @returns {Promise<Set<string>>}
 */
export async function likedReelIds(reelIds) {
  const profile = await getCurrentProfile();
  if (!profile || !reelIds.length) return new Set();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reel_likes")
    .select("reel_id")
    .eq("user_id", profile.id)
    .in("reel_id", reelIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.reel_id));
}

/**
 * Shops the signed-in user follows.
 * @param {string[]} vendorIds
 * @returns {Promise<Set<string>>}
 */
export async function followedShopIds(vendorIds) {
  const profile = await getCurrentProfile();
  if (!profile || !vendorIds.length) return new Set();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vendor_follows")
    .select("vendor_id")
    .eq("customer_id", profile.id)
    .in("vendor_id", vendorIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.vendor_id));
}

/**
 * @param {string} reelId
 * @returns {Promise<void>}
 */
export async function likeReel(reelId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to like reels.");

  const supabase = getSupabase();
  const { error } = await supabase.from("reel_likes").insert({
    reel_id: reelId,
    user_id: profile.id,
  });

  if (error) {
    if (error.code === "23505") return;
    throw error;
  }
}

/**
 * @param {string} reelId
 * @returns {Promise<void>}
 */
export async function unlikeReel(reelId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to unlike reels.");

  const supabase = getSupabase();
  const { error } = await supabase
    .from("reel_likes")
    .delete()
    .eq("reel_id", reelId)
    .eq("user_id", profile.id);

  if (error) throw error;
}

/**
 * @param {string} vendorId
 * @returns {Promise<void>}
 */
export async function followShop(vendorId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to follow shops.");

  const supabase = getSupabase();
  const { error } = await supabase.from("vendor_follows").insert({
    customer_id: profile.id,
    vendor_id: vendorId,
  });

  if (error) {
    if (error.code === "23505") return;
    throw error;
  }
}

/**
 * @param {string} vendorId
 * @returns {Promise<void>}
 */
export async function unfollowShop(vendorId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to unfollow shops.");

  const supabase = getSupabase();
  const { error } = await supabase
    .from("vendor_follows")
    .delete()
    .eq("customer_id", profile.id)
    .eq("vendor_id", vendorId);

  if (error) throw error;
}

/**
 * Comments on a public reel (anon can read).
 * @param {string} reelId
 * @returns {Promise<Array<{ id: string, body: string, created_at: string, author: string }>>}
 */
export async function listReelComments(reelId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reel_comments")
    .select("id, body, created_at, user_id, parent_id")
    .eq("reel_id", reelId)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const names = new Map();

  if (ids.length) {
    const profiles = await supabase.from("public_profiles").select("id, full_name").in("id", ids);
    if (!profiles.error) {
      for (const profile of profiles.data ?? []) names.set(profile.id, profile.full_name);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    author: names.get(row.user_id) || "Customer",
  }));
}

/**
 * @param {string} reelId
 * @param {string} body
 * @returns {Promise<void>}
 */
export async function postReelComment(reelId, body) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to comment.");

  const text = String(body || "").trim();
  if (text.length < 1 || text.length > 2000) {
    throw new Error("Comment must be 1 to 2000 characters.");
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("reel_comments").insert({
    reel_id: reelId,
    user_id: profile.id,
    body: text,
  });

  if (error) throw error;
}

/**
 * @param {object} row
 * @returns {object}
 */
function normalizeReel(row) {
  const shopRaw = row.vendor_profiles;
  const shop = Array.isArray(shopRaw) ? shopRaw[0] : shopRaw;
  const products = [...(row.reel_products || [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((link) => {
      const product = Array.isArray(link.products) ? link.products[0] : link.products;
      if (!product || product.status !== "active") return null;
      const image = pickProductImage(product.product_images);
      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        price: product.price,
        compare_at_price: product.compare_at_price,
        currency: product.currency,
        stock: product.stock,
        imageUrl: image ? productImageUrl(image.storage_path) : "",
      };
    })
    .filter(Boolean);

  return {
    id: row.id,
    vendorId: row.vendor_id,
    caption: row.caption,
    videoUrl: reelMediaUrl(row.video_path, "reel-videos"),
    thumbnailUrl: reelMediaUrl(row.thumbnail_path, "reel-thumbnails"),
    durationSeconds: row.duration_seconds,
    viewsCount: row.views_count,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    savesCount: row.saves_count,
    createdAt: row.created_at,
    shop: shop
      ? {
          profile_id: shop.profile_id,
          shop_name: shop.shop_name,
          slug: shop.slug,
          logo_url: shop.logo_url,
        }
      : null,
    products,
  };
}
