/**
 * Public live shopping streams and chat.
 * live_messages: authenticated only (select/insert). Anon cannot read chat.
 * Realtime: live_messages, live_streams, live_stream_products (see 0018_realtime.sql).
 * peak_viewers is readable but not client-writable. No live viewer-count column.
 */

import { getCurrentProfile } from "../auth.js";
import { getSupabase } from "../supabaseClient.js";
import { pickProductImage, productImageUrl } from "../media.js";

const STREAM_COLUMNS = `
  id,
  vendor_id,
  title,
  description,
  thumbnail_url,
  status,
  livekit_room_name,
  scheduled_at,
  started_at,
  ended_at,
  peak_viewers,
  pinned_product_id,
  created_at
`;

const PRODUCT_EMBED = `
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
`;

/**
 * LIVE NOW rooms of approved shops.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function listLiveNow(options = {}) {
  return listStreamsByStatus("live", {
    limit: options.limit ?? 24,
    order: { column: "started_at", ascending: false },
  });
}

/**
 * Upcoming scheduled rooms of approved shops.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function listUpcomingLives(options = {}) {
  return listStreamsByStatus("scheduled", {
    limit: options.limit ?? 24,
    order: { column: "scheduled_at", ascending: true },
  });
}

/**
 * @param {"live" | "scheduled" | "ended"} status
 * @param {{ limit: number, order: { column: string, ascending: boolean } }} options
 */
async function listStreamsByStatus(status, options) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("live_streams")
    .select(`
      ${STREAM_COLUMNS},
      vendor_profiles!inner (
        profile_id,
        shop_name,
        slug,
        logo_url,
        status
      )
    `)
    .eq("status", status)
    .eq("vendor_profiles.status", "approved")
    .order(options.order.column, { ascending: options.order.ascending })
    .limit(options.limit);

  if (error) throw error;
  return (data ?? []).map(normalizeStreamListItem);
}

/**
 * One public stream with shop + catalog products.
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function getLiveStream(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("live_streams")
    .select(`
      ${STREAM_COLUMNS},
      vendor_profiles!inner (
        profile_id,
        shop_name,
        slug,
        logo_url,
        status
      ),
      live_stream_products (
        sort_order,
        product_id,
        products ( ${PRODUCT_EMBED} )
      )
    `)
    .eq("id", id)
    .eq("vendor_profiles.status", "approved")
    .in("status", ["scheduled", "live", "ended"])
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeStreamDetail(data) : null;
}

/**
 * Chat lines for a live or ended room. Requires a signed-in user (RLS).
 * @param {string} streamId
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<{ id: string, body: string, created_at: string, user_id: string, author: string }>>}
 */
export async function listLiveMessages(streamId, options = {}) {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = getSupabase();
  const limit = options.limit ?? 80;
  const { data, error } = await supabase
    .from("live_messages")
    .select("id, body, created_at, user_id")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const names = new Map();

  if (ids.length) {
    const profiles = await supabase.from("public_profiles").select("id, full_name").in("id", ids);
    if (!profiles.error) {
      for (const row of profiles.data ?? []) names.set(row.id, row.full_name);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    user_id: row.user_id,
    author: names.get(row.user_id) || "Customer",
  }));
}

/**
 * Send a chat line while the room is live. Requires login.
 * @param {string} streamId
 * @param {string} body
 * @returns {Promise<void>}
 */
export async function sendLiveMessage(streamId, body) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to chat.");

  const text = String(body || "").trim();
  if (text.length < 1 || text.length > 500) {
    throw new Error("Message must be 1 to 500 characters.");
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("live_messages").insert({
    stream_id: streamId,
    user_id: profile.id,
    body: text,
  });

  if (error) throw error;
}

/**
 * Subscribe to chat inserts + stream status / pin updates.
 * Returns an unsubscribe function. No-op channel if Realtime fails to join.
 * @param {string} streamId
 * @param {{
 *   onMessage?: (row: { id: string, body: string, created_at: string, user_id: string }) => void,
 *   onStreamChange?: (row: object) => void,
 * }} handlers
 * @returns {() => void}
 */
export function subscribeLiveRoom(streamId, handlers = {}) {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`live-room:${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "live_messages",
        filter: `stream_id=eq.${streamId}`,
      },
      (payload) => {
        if (payload.new && handlers.onMessage) handlers.onMessage(payload.new);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "live_streams",
        filter: `id=eq.${streamId}`,
      },
      (payload) => {
        if (payload.new && handlers.onStreamChange) handlers.onStreamChange(payload.new);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
function normalizeStreamListItem(row) {
  const shop = unwrap(row.vendor_profiles);
  return {
    id: row.id,
    vendorId: row.vendor_id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url || "",
    status: row.status,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    peakViewers: row.peak_viewers,
    pinnedProductId: row.pinned_product_id,
    shop: shop
      ? {
          profile_id: shop.profile_id,
          shop_name: shop.shop_name,
          slug: shop.slug,
          logo_url: shop.logo_url,
        }
      : null,
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
function normalizeStreamDetail(row) {
  const base = normalizeStreamListItem(row);
  const products = [...(row.live_stream_products || [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((link) => {
      const product = unwrap(link.products);
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

  const pinned =
    products.find((product) => product.id === row.pinned_product_id) || products[0] || null;

  return {
    ...base,
    livekitRoomName: row.livekit_room_name,
    products,
    pinnedProduct: pinned,
  };
}

/**
 * @param {unknown} value
 * @returns {object | null}
 */
function unwrap(value) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}
