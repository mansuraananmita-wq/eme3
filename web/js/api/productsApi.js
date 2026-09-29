import { categoryBySlug } from "./categoriesApi.js";
import { getSupabase } from "../supabaseClient.js";

/** Shopper catalog page size. */
export const PAGE_SIZE = 12;

const LIST_COLUMNS = `
  id,
  title,
  slug,
  price,
  compare_at_price,
  currency,
  stock,
  sales_count,
  status,
  avg_rating,
  category_id,
  vendor_id,
  vendor_profiles!inner (
    profile_id,
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
`;

const DETAIL_COLUMNS = `
  id,
  title,
  slug,
  description,
  price,
  compare_at_price,
  currency,
  stock,
  status,
  avg_rating,
  reviews_count,
  category_id,
  vendor_id,
  vendor_profiles!inner (
    profile_id,
    shop_name,
    slug,
    logo_url,
    banner_url,
    description,
    status,
    created_at
  ),
  product_images (
    storage_path,
    sort_order,
    is_primary
  )
`;

/**
 * @param {string} value
 * @returns {string}
 */
function searchTerm(value) {
  return value.trim().replaceAll("%", "").replaceAll("_", "").replaceAll(",", " ");
}

/**
 * Active products from approved shops.
 * @param {{
 *   categorySlug?: string,
 *   q?: string,
 *   sort?: string,
 *   min?: number | null,
 *   max?: number | null,
 *   limit?: number,
 *   offset?: number,
 *   categoryId?: string,
 *   excludeId?: string,
 *   vendorId?: string,
 *   vendorSlug?: string
 * }} [filters]
 * @returns {Promise<{ rows: Array<object>, total: number, missingCategory?: boolean, missingShop?: boolean }>}
 */
export async function listProducts(filters = {}) {
  const supabase = getSupabase();
  let categoryId = filters.categoryId || null;
  let vendorId = filters.vendorId || null;

  if (filters.categorySlug) {
    const category = await categoryBySlug(filters.categorySlug);
    if (!category) return { rows: [], total: 0, missingCategory: true };
    categoryId = category.id;
  }

  if (filters.vendorSlug) {
    const { data: shop, error: shopError } = await supabase
      .from("vendor_profiles")
      .select("profile_id")
      .eq("slug", filters.vendorSlug)
      .eq("status", "approved")
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return { rows: [], total: 0, missingShop: true };
    vendorId = shop.profile_id;
  }

  let query = supabase
    .from("products")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("status", "active")
    .eq("vendor_profiles.status", "approved");

  if (categoryId) query = query.eq("category_id", categoryId);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (filters.excludeId) query = query.neq("id", filters.excludeId);

  const term = filters.q ? searchTerm(filters.q) : "";
  if (term) query = query.ilike("title", `%${term}%`);

  if (filters.min != null && Number.isFinite(filters.min)) query = query.gte("price", filters.min);
  if (filters.max != null && Number.isFinite(filters.max)) query = query.lte("price", filters.max);

  if (filters.sort === "price-asc") query = query.order("price", { ascending: true });
  else if (filters.sort === "price-desc") query = query.order("price", { ascending: false });
  else if (filters.sort === "trending") {
    query = query.order("sales_count", { ascending: false }).order("avg_rating", { ascending: false });
  } else query = query.order("created_at", { ascending: false });

  const limit = filters.limit ?? PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, missingCategory: false };
}

/**
 * @param {{ id?: string | null, slug?: string | null }} key
 * @returns {Promise<object | null>}
 */
export async function getProduct(key) {
  const supabase = getSupabase();
  let query = supabase
    .from("products")
    .select(DETAIL_COLUMNS)
    .eq("status", "active")
    .eq("vendor_profiles.status", "approved");

  if (key.id) query = query.eq("id", key.id);
  else if (key.slug) query = query.eq("slug", key.slug);
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Active products with a real compare_at_price discount (Flash Sale).
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function listDiscountedProducts(options = {}) {
  const supabase = getSupabase();
  const limit = options.limit ?? 16;
  const { data, error } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "active")
    .eq("vendor_profiles.status", "approved")
    .not("compare_at_price", "is", null)
    .order("sales_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, 24));

  if (error) throw error;

  return (data ?? [])
    .filter((row) => {
      const compare = Number(row.compare_at_price);
      const price = Number(row.price);
      return Number.isFinite(compare) && Number.isFinite(price) && compare > price;
    })
    .slice(0, limit);
}

/**
 * Other active products from the same shop.
 * @param {string} vendorId
 * @param {string} excludeId
 * @returns {Promise<Array<object>>}
 */
export async function productsFromShop(vendorId, excludeId) {
  const { rows } = await listProducts({
    vendorId,
    excludeId,
    sort: "newest",
    limit: 8,
    offset: 0,
  });
  return rows;
}

/**
 * Other active products in the same category.
 * @param {string} categoryId
 * @param {string} excludeId
 * @returns {Promise<Array<object>>}
 */
export async function relatedProducts(categoryId, excludeId) {
  const { rows } = await listProducts({
    categoryId,
    excludeId,
    sort: "newest",
    limit: 4,
    offset: 0,
  });
  return rows;
}

/**
 * Read-only reviews. Author names come from public_profiles.
 * @param {string} productId
 * @returns {Promise<Array<{ id: string, rating: number, comment: string | null, created_at: string, author: string }>>}
 */
export async function listReviews(productId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, rating, comment, created_at, customer_id")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const reviews = data ?? [];
  const ids = [...new Set(reviews.map((review) => review.customer_id).filter(Boolean))];
  const names = new Map();

  if (ids.length) {
    const profiles = await supabase.from("public_profiles").select("id, full_name").in("id", ids);
    if (!profiles.error) {
      for (const profile of profiles.data ?? []) names.set(profile.id, profile.full_name);
    }
  }

  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    created_at: review.created_at,
    author: names.get(review.customer_id) || "Customer",
  }));
}
