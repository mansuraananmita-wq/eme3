import { listCategories } from "./api/categoriesApi.js";
import { listProducts } from "./api/productsApi.js";

/**
 * Active categories for the home page.
 * @returns {Promise<Array<object>>}
 */
export async function fetchActiveCategories() {
  return listCategories();
}

/**
 * Newest active products from approved shops.
 * @param {string} [search]
 * @returns {Promise<Array<object>>}
 */
export async function fetchActiveProducts(search = "") {
  const { rows } = await listProducts({ q: search, sort: "newest", limit: 24, offset: 0 });
  return rows;
}
