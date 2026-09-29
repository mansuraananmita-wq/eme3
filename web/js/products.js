import { listCategories } from "./api/categoriesApi.js";
import { listProducts, PAGE_SIZE } from "./api/productsApi.js";
import { listApprovedShops } from "./api/shopsApi.js";
import { wishlistIds } from "./api/wishlistApi.js";
import { authErrorMessage, getCurrentProfile } from "./auth.js";
import { mountShell, toast } from "./components.js";
import { escapeHtml } from "./html.js";
import { bindCatalogActions, productCardHtml } from "./productView.js";
import { shopCardHtml } from "./shopView.js";
import { url } from "./paths.js";
import { showState } from "./ui-state.js";

mountShell({ page: "products" });

const grid = document.querySelector("#product-grid");
const more = document.querySelector("#load-more");
const summary = document.querySelector("#result-summary");
const form = document.querySelector("#filters");
const tabs = document.querySelector("#result-tabs");
const shopPanel = document.querySelector("#shop-results");

if (grid) bindCatalogActions(grid);

load();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const min = readMoney(data.get("min"));
  const max = readMoney(data.get("max"));
  if (min === "invalid" || max === "invalid") {
    toast("Enter prices as numbers, or leave them blank.", "error");
    return;
  }
  if (min != null && max != null && min > max) {
    toast("Minimum price cannot be higher than maximum price.", "error");
    return;
  }

  const params = new URLSearchParams();
  const category = String(data.get("category") || "");
  const shop = String(data.get("shop") || "");
  const q = String(data.get("q") || "").trim();
  const sort = String(data.get("sort") || "newest");
  const tab = String(data.get("tab") || "products");
  if (category) params.set("category", category);
  if (shop) params.set("shop", shop);
  if (q) params.set("q", q);
  if (sort && sort !== "newest") params.set("sort", sort);
  if (min != null) params.set("min", String(min));
  if (max != null) params.set("max", String(max));
  if (tab === "stores") params.set("tab", "stores");
  window.location.assign(`${url("pages/products.html")}?${params.toString()}`);
});

async function load() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category") || "";
  const shop = params.get("shop") || "";
  const q = params.get("q") || "";
  const sort = params.get("sort") || "newest";
  const tab = params.get("tab") === "stores" ? "stores" : "products";
  const min = readMoney(params.get("min"));
  const max = readMoney(params.get("max"));
  const page = Math.min(50, Math.max(1, Math.floor(Number(params.get("page")) || 1)));

  fillFilters({ category, shop, q, sort, min, max });
  renderTabs(q, tab, params);

  if (min === "invalid" || max === "invalid") {
    toast("Those prices are not valid.", "error");
    if (grid) {
      grid.innerHTML = `<p class="empty">Enter a valid price range.</p>`;
      grid.setAttribute("aria-busy", "false");
    }
    return;
  }

  if (tab === "stores") {
    await loadStores(q);
    return;
  }

  if (shopPanel) shopPanel.hidden = true;
  if (grid) grid.hidden = false;
  if (form) form.hidden = false;

  if (!grid) return;

  try {
    const [categories, shops, result, saved] = await Promise.all([
      listCategories(),
      listApprovedShops({ limit: 100 }),
      listProducts({
        categorySlug: category || undefined,
        vendorSlug: shop || undefined,
        q,
        sort,
        min: typeof min === "number" ? min : null,
        max: typeof max === "number" ? max : null,
        limit: page * PAGE_SIZE,
        offset: 0,
      }),
      savedIds(),
    ]);

    fillCategoryOptions(categories, category);
    fillShopOptions(shops, shop);

    if (result.missingCategory) {
      if (summary) summary.textContent = "";
      grid.innerHTML = `<p class="empty">That category is not available.</p>`;
      if (more) more.innerHTML = "";
    } else if (result.missingShop) {
      if (summary) summary.textContent = "";
      grid.innerHTML = `<p class="empty">That store is not available.</p>`;
      if (more) more.innerHTML = "";
    } else if (!result.rows.length) {
      if (summary) summary.textContent = "0 products";
      grid.innerHTML = `<p class="empty">No active products match these filters.</p>`;
      if (more) more.innerHTML = "";
    } else {
      if (summary) summary.textContent = `${result.total} product${result.total === 1 ? "" : "s"}`;
      grid.innerHTML = result.rows.map((product) => productCardHtml(product, { saved: saved.has(product.id) })).join("");
      if (more) {
        more.innerHTML = result.rows.length < result.total
          ? `<a class="button button-ghost" href="${escapeHtml(nextPageHref(params, page))}">Load more</a>`
          : "";
      }
    }
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(grid, escapeHtml(message), () => load());
  } finally {
    if (grid && grid.getAttribute("aria-busy") === "true") {
      grid.setAttribute("aria-busy", "false");
    }
  }
}

/**
 * @param {string} q
 */
async function loadStores(q) {
  if (grid) {
    grid.hidden = true;
    grid.innerHTML = "";
  }
  if (more) more.innerHTML = "";
  if (form) form.hidden = true;
  if (!shopPanel) return;

  shopPanel.hidden = false;
  shopPanel.setAttribute("aria-busy", "true");
  shopPanel.innerHTML = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;

  try {
    const shops = await listApprovedShops({ q, limit: 48 });
    if (summary) {
      summary.textContent = q
        ? `${shops.length} store${shops.length === 1 ? "" : "s"} for “${q}”`
        : `${shops.length} store${shops.length === 1 ? "" : "s"}`;
    }
    if (!shops.length) {
      showState(shopPanel, q ? "No stores match that search." : "No approved stores yet.");
      return;
    }
    shopPanel.setAttribute("aria-busy", "false");
    shopPanel.innerHTML = `<div class="shop-directory">${shops.map((shop) => shopCardHtml(shop)).join("")}</div>`;
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(shopPanel, escapeHtml(message), () => load());
  }
}

/**
 * @param {string} q
 * @param {string} tab
 * @param {URLSearchParams} params
 */
function renderTabs(q, tab, params) {
  if (!tabs) return;
  if (!q) {
    tabs.innerHTML = "";
    tabs.hidden = true;
    return;
  }

  const productParams = new URLSearchParams(params);
  productParams.delete("tab");
  productParams.delete("page");
  const storeParams = new URLSearchParams(params);
  storeParams.set("tab", "stores");
  storeParams.delete("page");

  tabs.hidden = false;
  tabs.innerHTML = `
    <a class="${tab === "products" ? "is-active" : ""}" href="${url("pages/products.html")}?${productParams}">Products</a>
    <a class="${tab === "stores" ? "is-active" : ""}" href="${url("pages/products.html")}?${storeParams}">Stores</a>
  `;
}

/**
 * @returns {Promise<Set<string>>}
 */
async function savedIds() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return new Set();
    return await wishlistIds();
  } catch {
    return new Set();
  }
}

/**
 * @param {Array<{ id: string, parent_id: string | null, name: string, slug: string }>} categories
 * @param {string} selected
 */
function fillCategoryOptions(categories, selected) {
  const select = form?.querySelector("[name='category']");
  if (!(select instanceof HTMLSelectElement)) return;
  const byId = new Map(categories.map((category) => [category.id, category]));
  const options = [`<option value="">All categories</option>`].concat(
    categories.map((category) => {
      const indent = "– ".repeat(depthOf(category, byId));
      const selectedAttr = category.slug === selected ? " selected" : "";
      return `<option value="${escapeHtml(category.slug)}"${selectedAttr}>${escapeHtml(indent + category.name)}</option>`;
    }),
  );
  select.innerHTML = options.join("");
}

/**
 * @param {Array<{ shop_name: string, slug: string }>} shops
 * @param {string} selected
 */
function fillShopOptions(shops, selected) {
  const select = form?.querySelector("[name='shop']");
  if (!(select instanceof HTMLSelectElement)) return;
  select.innerHTML = [`<option value="">All stores</option>`]
    .concat(shops.map((shop) => {
      const selectedAttr = shop.slug === selected ? " selected" : "";
      return `<option value="${escapeHtml(shop.slug)}"${selectedAttr}>${escapeHtml(shop.shop_name)}</option>`;
    }))
    .join("");
}

/**
 * @param {{ category: string, shop: string, q: string, sort: string, min: number | null | "invalid", max: number | null | "invalid" }} values
 */
function fillFilters(values) {
  setValue("q", values.q);
  setValue("shop", values.shop);
  setValue("sort", ["newest", "price-asc", "price-desc", "trending"].includes(values.sort) ? values.sort : "newest");
  setValue("min", typeof values.min === "number" ? String(values.min) : "");
  setValue("max", typeof values.max === "number" ? String(values.max) : "");
}

/**
 * @param {string} name
 * @param {string} value
 */
function setValue(name, value) {
  const field = form?.querySelector(`[name='${name}']`);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value;
}

/**
 * @param {FormDataEntryValue | string | null} value
 * @returns {number | null | "invalid"}
 */
function readMoney(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return "invalid";
  return number;
}

/**
 * @param {{ parent_id: string | null }} category
 * @param {Map<string, { parent_id: string | null }>} byId
 * @returns {number}
 */
function depthOf(category, byId) {
  let depth = 0;
  let parent = category.parent_id;
  const seen = new Set();
  while (parent && byId.has(parent) && !seen.has(parent) && depth < 6) {
    seen.add(parent);
    depth += 1;
    parent = byId.get(parent).parent_id;
  }
  return depth;
}

/**
 * @param {URLSearchParams} params
 * @param {number} page
 * @returns {string}
 */
function nextPageHref(params, page) {
  const next = new URLSearchParams(params);
  next.set("page", String(page + 1));
  return `${url("pages/products.html")}?${next.toString()}`;
}
