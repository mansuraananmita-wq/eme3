/**
 * Public reels feed and engagement.
 * Clients cannot write views_count / shares_count (trigger-guarded).
 */

import { getCurrentProfile } from "../auth.js";
import { getSupabase } from "../supabaseClient.js";
import { pickProductImage, productImageUrl } from "../media.js";

export const REELS_PAGE_SIZE = 8;

/** @type {number} */
export const REEL_VIDEO_MAX_BYTES = 52_428_800;

/** @type {string[]} */
export const REEL_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];

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
 * Whether the signed-in user saved these reels.
 * @param {string[]} reelIds
 * @returns {Promise<Set<string>>}
 */
export async function savedReelIds(reelIds) {
  const profile = await getCurrentProfile();
  if (!profile || !reelIds.length) return new Set();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reel_saves")
    .select("reel_id")
    .eq("user_id", profile.id)
    .in("reel_id", reelIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.reel_id));
}

/**
 * @param {string} reelId
 * @returns {Promise<void>}
 */
export async function saveReel(reelId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to save reels.");

  const supabase = getSupabase();
  const { error } = await supabase.from("reel_saves").insert({
    reel_id: reelId,
    user_id: profile.id,
  });

  if (error) {
    if (error.code === "23505") return;
    console.error("save reel:", error);
    throw error;
  }
}

/**
 * @param {string} reelId
 * @returns {Promise<void>}
 */
export async function unsaveReel(reelId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to save reels.");

  const supabase = getSupabase();
  const { error } = await supabase
    .from("reel_saves")
    .delete()
    .eq("reel_id", reelId)
    .eq("user_id", profile.id);

  if (error) {
    console.error("unsave reel:", error);
    throw error;
  }
}

const SESSION_KEY = "eme-session";

/**
 * Stable browser session id for view and share counting.
 * @returns {string}
 */
export function browserSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing && existing.length >= 8 && existing.length <= 128) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}

const pendingCounts = new Set();
let engagementRpc = true;

/**
 * Counts one view per session. No-op until f9_reel_engagement.sql is applied.
 * @param {string} reelId
 * @returns {Promise<void>}
 */
export async function recordReelView(reelId) {
  if (!engagementRpc) return;
  const seenKey = `eme-reel-view-${reelId}`;
  if (window.sessionStorage.getItem(seenKey) || pendingCounts.has(seenKey)) return;
  pendingCounts.add(seenKey);
  const supabase = getSupabase();
  const { error } = await supabase.rpc("record_reel_view", {
    p_reel_id: reelId,
    p_session_id: browserSessionId(),
  });
  if (error) {
    pendingCounts.delete(seenKey);
    if (engagementRpc) console.error("record_reel_view:", error);
    if (error.code === "PGRST202") engagementRpc = false;
    return;
  }
  window.sessionStorage.setItem(seenKey, "1");
}

/**
 * Counts one share per session after the link was actually shared or copied.
 * @param {string} reelId
 * @returns {Promise<void>}
 */
export async function recordReelShare(reelId) {
  if (!engagementRpc) return;
  const seenKey = `eme-reel-share-${reelId}`;
  if (window.sessionStorage.getItem(seenKey) || pendingCounts.has(seenKey)) return;
  pendingCounts.add(seenKey);
  const supabase = getSupabase();
  const { error } = await supabase.rpc("record_reel_share", {
    p_reel_id: reelId,
    p_session_id: browserSessionId(),
  });
  if (error) {
    pendingCounts.delete(seenKey);
    if (engagementRpc) console.error("record_reel_share:", error);
    if (error.code === "PGRST202") engagementRpc = false;
    return;
  }
  window.sessionStorage.setItem(seenKey, "1");
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
 * @returns {Promise<Array<{ id: string, parentId: string | null, body: string, created_at: string, author: string }>>}
 */
export async function listReelComments(reelId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reel_comments")
    .select("id, body, created_at, user_id, parent_id")
    .eq("reel_id", reelId)
    .order("created_at", { ascending: true })
    .limit(80);

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
    parentId: row.parent_id,
    body: row.body,
    created_at: row.created_at,
    author: names.get(row.user_id) || "Customer",
  }));
}

/**
 * @param {string} reelId
 * @param {string} body
 * @param {string | null} [parentId]
 * @returns {Promise<void>}
 */
export async function postReelComment(reelId, body, parentId = null) {
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
    parent_id: parentId || null,
  });

  if (error) {
    console.error("post reel comment:", error);
    throw error;
  }
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

/**
 * Reels owned by the signed-in approved vendor (draft + published).
 * @returns {Promise<Array<object>>}
 */
export async function listMyReels() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage reels.");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reels")
    .select(`
      ${REEL_COLUMNS},
      reel_products ( product_id, sort_order )
    `)
    .eq("vendor_id", profile.id)
    .neq("status", "removed")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    caption: row.caption,
    videoUrl: reelMediaUrl(row.video_path, "reel-videos"),
    thumbnailUrl: reelMediaUrl(row.thumbnail_path, "reel-thumbnails"),
    videoPath: row.video_path,
    thumbnailPath: row.thumbnail_path,
    durationSeconds: row.duration_seconds,
    status: row.status,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    createdAt: row.created_at,
    productIds: [...(row.reel_products || [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((link) => link.product_id),
  }));
}

/**
 * Active products the signed-in vendor can tag on reels.
 * @returns {Promise<Array<{ id: string, title: string }>>}
 */
export async function listMyProductsForReels() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage reels.");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, title")
    .eq("vendor_id", profile.id)
    .eq("status", "active")
    .order("title", { ascending: true })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

/**
 * @param {{ caption?: string, status?: "draft" | "published" }} input
 * @returns {Promise<string>} reel id
 */
export async function createReel(input = {}) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to create a reel.");

  const status = input.status === "published" ? "published" : "draft";
  const caption = String(input.caption || "").trim() || null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reels")
    .insert({
      vendor_id: profile.id,
      caption,
      status,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * @param {string} reelId
 * @param {{ caption?: string, status?: "draft" | "published", video_path?: string | null, thumbnail_path?: string | null, duration_seconds?: number | null }} patch
 * @returns {Promise<void>}
 */
export async function updateReel(reelId, patch) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to update reels.");

  const body = {};
  if (patch.caption !== undefined) body.caption = patch.caption?.trim() || null;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.video_path !== undefined) body.video_path = patch.video_path;
  if (patch.thumbnail_path !== undefined) body.thumbnail_path = patch.thumbnail_path;
  if (patch.duration_seconds !== undefined) body.duration_seconds = patch.duration_seconds;

  const supabase = getSupabase();
  const { error } = await supabase.from("reels").update(body).eq("id", reelId).eq("vendor_id", profile.id);
  if (error) throw error;
}

/**
 * @param {string} reelId
 * @returns {Promise<void>}
 */
export async function deleteReel(reelId) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to delete reels.");

  const supabase = getSupabase();
  const { error } = await supabase.from("reels").delete().eq("id", reelId).eq("vendor_id", profile.id);
  if (error) throw error;
}

/**
 * Replace tagged products (max 5, own products only — enforced by RLS).
 * @param {string} reelId
 * @param {string[]} productIds
 * @returns {Promise<void>}
 */
export async function setReelProductTags(reelId, productIds) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to tag products.");

  const ids = [...new Set(productIds)].slice(0, 5);
  const supabase = getSupabase();

  const { error: delError } = await supabase.from("reel_products").delete().eq("reel_id", reelId);
  if (delError) throw delError;

  if (!ids.length) return;

  const rows = ids.map((product_id, index) => ({
    reel_id: reelId,
    product_id,
    sort_order: index,
  }));

  const { error } = await supabase.from("reel_products").insert(rows);
  if (error) throw error;
}

/**
 * Upload reel video to Storage ({auth.uid()}/{reelId}.ext).
 * @param {string} reelId
 * @param {File} file
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<string>} storage path stored on reels.video_path
 */
export async function uploadReelVideo(reelId, file, onProgress) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to upload.");

  if (!REEL_VIDEO_MIME.includes(file.type)) {
    throw new Error("Use an MP4, WebM, or MOV file.");
  }
  if (file.size > REEL_VIDEO_MAX_BYTES) {
    throw new Error("Video must be 50 MB or smaller.");
  }

  const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  const path = `${profile.id}/${reelId}.${ext}`;
  const supabase = getSupabase();

  onProgress?.(5);
  const { error: uploadError } = await supabase.storage.from("reel-videos").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;
  onProgress?.(85);

  await updateReel(reelId, { video_path: path });
  onProgress?.(100);
  return path;
}

/**
 * @param {string} reelId
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadReelThumbnail(reelId, file) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to upload.");

  if (!file.type.startsWith("image/")) {
    throw new Error("Thumbnail must be an image.");
  }
  if (file.size > 2_097_152) {
    throw new Error("Thumbnail must be 2 MB or smaller.");
  }

  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const path = `${profile.id}/${reelId}-thumb.${ext}`;
  const supabase = getSupabase();

  const { error: uploadError } = await supabase.storage.from("reel-thumbnails").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  await updateReel(reelId, { thumbnail_path: path });
  return path;
}
