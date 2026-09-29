import { getSupabase } from "../supabaseClient.js";

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
export async function listCategories() {
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
 * @param {string} slug
 * @returns {Promise<{ id: string, parent_id: string | null, name: string, slug: string, image_url: string | null } | null>}
 */
export async function categoryBySlug(slug) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, name, slug, image_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}
