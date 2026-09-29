import { listProducts, PAGE_SIZE } from "./api/productsApi.js";
import { getShop, listShopLives, listShopReels } from "./api/shopsApi.js";
import { wishlistIds } from "./api/wishlistApi.js";
import { authErrorMessage, getCurrentProfile } from "./auth.js";
import { mountShell, toast } from "./components.js";
import { escapeHtml } from "./html.js";
import { bindCatalogActions, productCardHtml } from "./productView.js";
import { shopLogoHtml } from "./shopView.js";
import { showState } from "./ui-state.js";
import { url } from "./paths.js";

mountShell({ page: "shop" });

const root = document.querySelector("#shop-root");
const tabs = document.querySelector("#shop-tabs");
const panel = document.querySelector("#shop-panel");

/** @type {object | null} */
let shop = null;

load();

async function load() {
  if (!root || !panel) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const slug = params.get("slug");
  const tab = params.get("tab") || "products";

  if (!id && !slug) {
    showState(root, "Choose a store from the directory.", () => {
      window.location.assign(url("pages/shops.html"));
    });
    return;
  }

  try {
    shop = await getShop({ id, slug });
    if (!shop) {
      showState(root, "This store is not available.");
      if (tabs) tabs.innerHTML = "";
      panel.innerHTML = "";
      return;
    }

    document.title = `${shop.shop_name} — EME`;
    renderHeader(shop);
    renderTabs(tab);
    await renderPanel(tab);
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
  }
}

/**
 * @param {object} shopRow
 */
function renderHeader(shopRow) {
  if (!root) return;
  const joined = formatJoined(shopRow.created_at);
  const banner = shopRow.banner_url
    ? `<img src="${escapeHtml(shopRow.banner_url)}" alt="" onerror="this.hidden=true">`
    : "";

  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <div class="storefront-banner">${banner || `<div class="storefront-banner-empty"></div>`}</div>
    <div class="storefront-head">
      ${shopLogoHtml(shopRow, "shop-logo-lg")}
      <div>
        <h1>${escapeHtml(shopRow.shop_name)}</h1>
        <p class="muted">${escapeHtml(String(shopRow.productCount))} products · Joined ${escapeHtml(joined)}</p>
        <p>${escapeHtml(shopRow.description || "Independent seller on the EME marketplace.")}</p>
      </div>
    </div>
  `;
}

/**
 * @param {string} active
 */
function renderTabs(active) {
  if (!tabs || !shop) return;
  const base = `${url("pages/shop.html")}?slug=${encodeURIComponent(shop.slug)}`;
  tabs.innerHTML = `
    <a class="${active === "products" ? "is-active" : ""}" href="${base}&tab=products">Products</a>
    <a class="${active === "about" ? "is-active" : ""}" href="${base}&tab=about">About</a>
    <a class="${active === "reels" ? "is-active" : ""}" href="${base}&tab=reels">Reels</a>
    <a class="${active === "live" ? "is-active" : ""}" href="${base}&tab=live">Live</a>
  `;
}

/**
 * @param {string} tab
 */
async function renderPanel(tab) {
  if (!panel || !shop) return;
  panel.innerHTML = `<div class="skeleton skeleton-card"></div>`;

  try {
    if (tab === "about") {
      panel.innerHTML = `
        <div class="about-panel">
          <h2>About ${escapeHtml(shop.shop_name)}</h2>
          <p>${escapeHtml(shop.description || "This seller has not added a longer story yet.")}</p>
          <p class="muted">Store slug: ${escapeHtml(shop.slug)}</p>
        </div>
      `;
      return;
    }

    if (tab === "reels") {
      const reels = await listShopReels(shop.profile_id);
      if (!reels.length) {
        showState(panel, "No published reels from this store yet.");
        return;
      }
      panel.innerHTML = `
        <div class="content-grid">
          ${reels.map((reel) => `
            <article class="content-card">
              <div class="content-thumb">${reel.thumbnail_path ? `<img src="${escapeHtml(reel.thumbnail_path)}" alt="" loading="lazy">` : `<span class="thumb-fallback"></span>`}</div>
              <p>${escapeHtml(reel.caption || "Reel")}</p>
            </article>
          `).join("")}
        </div>
      `;
      return;
    }

    if (tab === "live") {
      const lives = await listShopLives(shop.profile_id);
      if (!lives.length) {
        showState(panel, "No live sessions from this store yet.");
        return;
      }
      panel.innerHTML = `
        <div class="content-grid">
          ${lives.map((live) => `
            <article class="content-card">
              <div class="content-thumb">${live.thumbnail_url ? `<img src="${escapeHtml(live.thumbnail_url)}" alt="" loading="lazy">` : `<span class="thumb-fallback"></span>`}</div>
              <p><strong>${escapeHtml(live.title)}</strong></p>
              <p class="muted">${escapeHtml(live.status)}</p>
            </article>
          `).join("")}
        </div>
      `;
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const sort = params.get("sort") || "newest";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const [result, saved] = await Promise.all([
      listProducts({
        vendorId: shop.profile_id,
        sort,
        limit: page * PAGE_SIZE,
        offset: 0,
      }),
      savedIds(),
    ]);

    if (!result.rows.length) {
      showState(panel, "This store has no active products yet.");
      return;
    }

    panel.innerHTML = `
      <form class="filters filters-compact" id="shop-product-filters">
        <label>Sort
          <select name="sort">
            <option value="newest" ${sort === "newest" ? "selected" : ""}>Newest</option>
            <option value="price-asc" ${sort === "price-asc" ? "selected" : ""}>Price: low to high</option>
            <option value="price-desc" ${sort === "price-desc" ? "selected" : ""}>Price: high to low</option>
            <option value="trending" ${sort === "trending" ? "selected" : ""}>Trending</option>
          </select>
        </label>
        <button class="button button-primary" type="submit">Apply</button>
      </form>
      <div class="product-grid" id="shop-products">
        ${result.rows.map((product) => productCardHtml(product, { saved: saved.has(product.id) })).join("")}
      </div>
      <div class="load-more">
        ${result.rows.length < result.total
          ? `<a class="button button-ghost" href="${url("pages/shop.html")}?slug=${encodeURIComponent(shop.slug)}&tab=products&sort=${encodeURIComponent(sort)}&page=${page + 1}">Load more</a>`
          : ""}
      </div>
    `;

    const grid = panel.querySelector("#shop-products");
    if (grid instanceof HTMLElement) bindCatalogActions(grid);
    panel.querySelector("#shop-product-filters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = String(new FormData(event.currentTarget).get("sort") || "newest");
      window.location.assign(`${url("pages/shop.html")}?slug=${encodeURIComponent(shop.slug)}&tab=products&sort=${encodeURIComponent(next)}`);
    });
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(panel, escapeHtml(message), () => renderPanel(tab));
  }
}

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
 * @param {string | null | undefined} value
 * @returns {string}
 */
function formatJoined(value) {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}
