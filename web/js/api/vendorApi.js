/**
 * Vendor studio: own catalog, shop profile, live rooms, payouts, and chat.
 * Writes use the anon key. RLS allows them only for the signed-in shop.
 */

import { getCurrentProfile } from "../auth.js";
import { productImageUrl } from "../media.js";
import { slugifyShopName } from "./shopsApi.js";
import { getSupabase } from "../supabaseClient.js";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PRODUCT_IMAGE_MAX = 5_242_880;
const SHOP_IMAGE_MAX = 5_242_880;
const LIVE_THUMB_MAX = 2_097_152;

/**
 * @returns {Promise<object>}
 */
async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage your shop.");
  return profile;
}

/**
 * @param {string} name
 * @returns {string}
 */
export function slugifyProductTitle(name) {
  const slug = slugifyShopName(name);
  return slug || "product";
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listMyProducts() {
  const profile = await requireProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, title, slug, description, price, compare_at_price, currency, stock, sku, status, category_id, created_at,
      product_images ( id, storage_path, sort_order, is_primary )
    `)
    .eq("vendor_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listMyProducts:", error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    ...row,
    images: [...(row.product_images || [])].sort((a, b) => a.sort_order - b.sort_order),
    imageUrl: productImageUrl(
      [...(row.product_images || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]
        ?.storage_path,
    ),
  }));
}

/**
 * @param {object} input
 * @returns {Promise<string>}
 */
export async function saveProduct(input) {
  const profile = await requireProfile();
  const title = String(input.title || "").trim();
  const slug = slugifyProductTitle(String(input.slug || title));
  const price = Number(input.price);
  const compareRaw = String(input.compare_at_price ?? "").trim();
  const compare = compareRaw === "" ? null : Number(compareRaw);
  const stock = Math.max(0, Math.floor(Number(input.stock) || 0));
  const status = input.status === "active" || input.status === "archived" ? input.status : "draft";
  const sku = String(input.sku || "").trim() || null;
  const description = String(input.description || "").trim() || null;
  const categoryId = String(input.category_id || "").trim();

  if (title.length < 2 || title.length > 180) throw new Error("Title must be 2 to 180 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug must be lowercase letters, numbers, and hyphens.");
  if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid price.");
  if (compare != null && (!Number.isFinite(compare) || compare < price)) {
    throw new Error("Compare-at price must be empty or at least the selling price.");
  }
  if (!categoryId) throw new Error("Choose a category.");

  const body = {
    category_id: categoryId,
    title,
    slug,
    description,
    price,
    compare_at_price: compare,
    currency: "BDT",
    stock,
    sku,
    status,
  };

  const supabase = getSupabase();
  if (input.id) {
    const { error } = await supabase.from("products").update(body).eq("id", input.id).eq("vendor_id", profile.id);
    if (error) {
      console.error("update product:", error);
      throw error;
    }
    return input.id;
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...body, vendor_id: profile.id })
    .select("id")
    .single();
  if (error) {
    console.error("insert product:", error);
    throw error;
  }
  return data.id;
}

/**
 * @param {string} productId
 * @returns {Promise<void>}
 */
export async function deleteProduct(productId) {
  const profile = await requireProfile();
  const supabase = getSupabase();
  const { error } = await supabase.from("products").delete().eq("id", productId).eq("vendor_id", profile.id);
  if (error) {
    console.error("delete product:", error);
    throw error;
  }
}

/**
 * @param {string} productId
 * @param {File} file
 * @returns {Promise<void>}
 */
export async function uploadProductImage(productId, file) {
  const profile = await requireProfile();
  assertImage(file, PRODUCT_IMAGE_MAX, "Product image");
  const ext = extOf(file);
  const path = `${profile.id}/${productId}-${Date.now()}.${ext}`;
  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) {
    console.error("product image upload:", uploadError);
    throw uploadError;
  }

  const existing = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId);
  if (existing.error) throw existing.error;
  const isPrimary = (existing.data || []).length === 0;

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: path,
    sort_order: (existing.data || []).length,
    is_primary: isPrimary,
  });
  if (error) {
    console.error("product image row:", error);
    throw error;
  }
}

/**
 * @param {string} imageId
 * @returns {Promise<void>}
 */
export async function deleteProductImage(imageId) {
  await requireProfile();
  const supabase = getSupabase();
  const current = await supabase
    .from("product_images")
    .select("id, product_id, is_primary")
    .eq("id", imageId)
    .maybeSingle();
  if (current.error) {
    console.error("read product image:", current.error);
    throw current.error;
  }
  if (!current.data) return;

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) {
    console.error("delete product image:", error);
    throw error;
  }

  if (!current.data.is_primary) return;
  const next = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", current.data.product_id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (next.error) throw next.error;
  if (!next.data?.id) return;
  const promoted = await supabase.from("product_images").update({ is_primary: true }).eq("id", next.data.id);
  if (promoted.error) throw promoted.error;
}

/**
 * @param {string} productId
 * @param {string} imageId
 * @returns {Promise<void>}
 */
export async function setPrimaryImage(productId, imageId) {
  await requireProfile();
  const supabase = getSupabase();
  const cleared = await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .neq("id", imageId);
  if (cleared.error) {
    console.error("clear primary image:", cleared.error);
    throw cleared.error;
  }
  const { error } = await supabase.from("product_images").update({ is_primary: true }).eq("id", imageId);
  if (error) {
    console.error("set primary image:", error);
    throw error;
  }
}

/**
 * @param {{ shop_name: string, slug: string, description?: string, logo_url?: string, banner_url?: string }} input
 * @returns {Promise<void>}
 */
export async function updateMyShop(input) {
  const profile = await requireProfile();
  const shopName = String(input.shop_name || "").trim();
  const slug = slugifyShopName(String(input.slug || ""));
  const description = String(input.description || "").trim() || null;
  if (shopName.length < 2 || shopName.length > 80) throw new Error("Shop name must be 2 to 80 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug must be lowercase letters, numbers, and hyphens.");

  const supabase = getSupabase();
  const { error } = await supabase
    .from("vendor_profiles")
    .update({
      shop_name: shopName,
      slug,
      description,
      logo_url: httpUrlOrNull(input.logo_url),
      banner_url: httpUrlOrNull(input.banner_url),
    })
    .eq("profile_id", profile.id);
  if (error) {
    console.error("update shop:", error);
    throw error;
  }
}

/**
 * @param {"logo" | "banner"} kind
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadShopImage(kind, file) {
  const profile = await requireProfile();
  assertImage(file, SHOP_IMAGE_MAX, "Shop image");
  const path = `${profile.id}/${kind}-${Date.now()}.${extOf(file)}`;
  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage.from("shop-media").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) {
    console.error("shop image upload:", uploadError);
    throw uploadError;
  }
  const { data } = supabase.storage.from("shop-media").getPublicUrl(path);
  const publicUrl = data?.publicUrl || "";
  const column = kind === "banner" ? "banner_url" : "logo_url";
  const { error } = await supabase.from("vendor_profiles").update({ [column]: publicUrl }).eq("profile_id", profile.id);
  if (error) {
    console.error("shop image save:", error);
    throw error;
  }
  return publicUrl;
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listMyLives() {
  const profile = await requireProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("live_streams")
    .select("id, title, description, status, scheduled_at, started_at, ended_at, livekit_room_name, pinned_product_id, thumbnail_url, live_stream_products(product_id, sort_order)")
    .eq("vendor_id", profile.id)
    .neq("status", "removed")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listMyLives:", error);
    throw error;
  }
  return data ?? [];
}

/**
 * @param {{ title: string, description?: string, scheduled_at: string }} input
 * @returns {Promise<string>}
 */
export async function createScheduledLive(input) {
  const profile = await requireProfile();
  const title = String(input.title || "").trim();
  if (title.length < 2 || title.length > 140) throw new Error("Title must be 2 to 140 characters.");
  const scheduledAt = String(input.scheduled_at || "").trim();
  if (!scheduledAt) throw new Error("Choose a schedule time.");

  const room = `eme-${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("live_streams")
    .insert({
      vendor_id: profile.id,
      title,
      description: String(input.description || "").trim() || null,
      status: "scheduled",
      scheduled_at: new Date(scheduledAt).toISOString(),
      livekit_room_name: room,
    })
    .select("id")
    .single();
  if (error) {
    console.error("create live:", error);
    throw error;
  }
  return data.id;
}

/**
 * @param {string} streamId
 * @param {"live" | "ended"} status
 * @returns {Promise<void>}
 */
export async function setLiveStatus(streamId, status) {
  const profile = await requireProfile();
  const patch = status === "live"
    ? { status: "live", started_at: new Date().toISOString() }
    : { status: "ended", ended_at: new Date().toISOString() };
  const supabase = getSupabase();
  const { error } = await supabase.from("live_streams").update(patch).eq("id", streamId).eq("vendor_id", profile.id);
  if (error) {
    console.error("set live status:", error);
    throw error;
  }
}

/**
 * @param {string} streamId
 * @param {string[]} productIds
 * @returns {Promise<void>}
 */
export async function setLiveProducts(streamId, productIds) {
  await requireProfile();
  const supabase = getSupabase();
  const { error: delError } = await supabase.from("live_stream_products").delete().eq("stream_id", streamId);
  if (delError) {
    console.error("clear live products:", delError);
    throw delError;
  }
  const ids = [...new Set(productIds)].slice(0, 20);
  if (!ids.length) return;
  const { error } = await supabase.from("live_stream_products").insert(
    ids.map((product_id, index) => ({ stream_id: streamId, product_id, sort_order: index })),
  );
  if (error) {
    console.error("set live products:", error);
    throw error;
  }
}

/**
 * @param {string} streamId
 * @param {string | null} productId
 * @returns {Promise<void>}
 */
export async function pinLiveProduct(streamId, productId) {
  const profile = await requireProfile();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("live_streams")
    .update({ pinned_product_id: productId })
    .eq("id", streamId)
    .eq("vendor_id", profile.id);
  if (error) {
    console.error("pin live product:", error);
    throw error;
  }
}

/**
 * @param {string} streamId
 * @param {File} file
 * @returns {Promise<void>}
 */
export async function uploadLiveThumbnail(streamId, file) {
  const profile = await requireProfile();
  assertImage(file, LIVE_THUMB_MAX, "Live thumbnail");
  const path = `${profile.id}/${streamId}.${extOf(file)}`;
  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage.from("live-thumbnails").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) {
    console.error("live thumb upload:", uploadError);
    throw uploadError;
  }
  const { data } = supabase.storage.from("live-thumbnails").getPublicUrl(path);
  const { error } = await supabase
    .from("live_streams")
    .update({ thumbnail_url: data?.publicUrl || path })
    .eq("id", streamId)
    .eq("vendor_id", profile.id);
  if (error) throw error;
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listMyPayouts() {
  const profile = await requireProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payouts")
    .select("id, amount, currency, period_start, period_end, status, reference, created_at")
    .eq("vendor_id", profile.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("list payouts:", error);
    throw error;
  }
  return data ?? [];
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listMyConversations() {
  const profile = await requireProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, customer_id, vendor_id, product_id, created_at, updated_at")
    .or(`customer_id.eq.${profile.id},vendor_id.eq.${profile.id}`)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("list conversations:", error);
    throw error;
  }
  const rows = data ?? [];
  const ids = [...new Set(rows.flatMap((row) => [row.customer_id, row.vendor_id]))];
  const names = await publicNames(ids);
  return rows.map((row) => ({
    ...row,
    customerName: names.get(row.customer_id) || "Customer",
    vendorName: names.get(row.vendor_id) || "Shop",
  }));
}

/**
 * Opens the customer's thread with a shop. Vendors cannot start a thread.
 * @param {string} vendorId
 * @param {string | null} productId
 * @returns {Promise<string>}
 */
export async function openCustomerThread(vendorId, productId) {
  const profile = await requireProfile();
  if (profile.id === vendorId) throw new Error("You cannot message your own shop.");
  const supabase = getSupabase();
  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("customer_id", profile.id)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      customer_id: profile.id,
      vendor_id: vendorId,
      product_id: productId || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("open conversation:", error);
    throw error;
  }
  return data.id;
}

/**
 * @param {string} conversationId
 * @returns {Promise<object | null>}
 */
export async function getConversation(conversationId) {
  const profile = await requireProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, customer_id, vendor_id, product_id, created_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    console.error("get conversation:", error);
    throw error;
  }
  if (!data) return null;
  const names = await publicNames([data.customer_id, data.vendor_id]);
  const mineIsCustomer = data.customer_id === profile.id;
  return {
    ...data,
    otherName: mineIsCustomer
      ? (names.get(data.vendor_id) || "Shop")
      : (names.get(data.customer_id) || "Customer"),
  };
}

/**
 * @param {string} conversationId
 * @returns {Promise<Array<object>>}
 */
export async function listMessages(conversationId) {
  await requireProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, read_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error("list messages:", error);
    throw error;
  }
  return data ?? [];
}

/**
 * @param {string} conversationId
 * @param {string} body
 * @returns {Promise<void>}
 */
export async function sendMessage(conversationId, body) {
  const profile = await requireProfile();
  const text = String(body || "").trim();
  if (text.length < 1 || text.length > 4000) throw new Error("Message must be 1 to 4000 characters.");
  const supabase = getSupabase();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: profile.id,
    body: text,
  });
  if (error) {
    console.error("send message:", error);
    throw error;
  }
}

/**
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
export async function markThreadRead(conversationId) {
  const profile = await requireProfile();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .is("read_at", null)
    .neq("sender_id", profile.id);
  if (error) {
    console.error("mark read:", error);
    throw error;
  }
}

/**
 * @param {string[]} ids
 * @returns {Promise<Map<string, string>>}
 */
async function publicNames(ids) {
  const names = new Map();
  if (!ids.length) return names;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("public_profiles").select("id, full_name").in("id", ids);
  if (error) {
    console.error("public names:", error);
    return names;
  }
  for (const row of data ?? []) names.set(row.id, row.full_name || "Customer");
  return names;
}

/**
 * @param {File} file
 * @param {number} max
 * @param {string} label
 */
function assertImage(file, max, label) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error(`${label} must be JPEG, PNG, WebP, or GIF.`);
  if (file.size > max) throw new Error(`${label} must be ${Math.round(max / 1024 / 1024)} MB or smaller.`);
}

/**
 * @param {File} file
 * @returns {string}
 */
function extOf(file) {
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  if (file.type.includes("gif")) return "gif";
  return "jpg";
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function httpUrlOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error("Image URL must start with https://");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Image URL must start with https://");
  }
  return parsed.href;
}
