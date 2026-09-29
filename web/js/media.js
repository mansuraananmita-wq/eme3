import { getSupabase } from "./supabaseClient.js";

/**
 * Chooses the primary image, otherwise the lowest sort_order.
 * @param {Array<{ storage_path: string, sort_order: number, is_primary: boolean }> | null | undefined} images
 * @returns {{ storage_path: string, sort_order: number, is_primary: boolean } | null}
 */
export function pickProductImage(images) {
  if (!images?.length) return null;
  const primary = images.find((image) => image.is_primary);
  if (primary) return primary;
  return [...images].sort((a, b) => a.sort_order - b.sort_order)[0];
}

/**
 * product_images.storage_path is either a full URL or a path in the product-images bucket.
 * @param {string | null | undefined} storagePath
 * @returns {string}
 */
export function productImageUrl(storagePath) {
  if (!storagePath) return "";
  if (/^https?:\/\//i.test(storagePath)) return storagePath;

  const { data } = getSupabase().storage.from("product-images").getPublicUrl(storagePath);
  return data?.publicUrl || "";
}
