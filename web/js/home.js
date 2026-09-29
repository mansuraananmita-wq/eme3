import { authErrorMessage, getCurrentProfile } from "./auth.js";
import { mountShell, toast } from "./components.js";
import { escapeHtml } from "./html.js";
import { isSupabaseConfigured } from "./supabaseClient.js";
import { url } from "./paths.js";
import { showState, syncConfigBanner } from "./ui-state.js";
import { bindCatalogActions, productCardHtml } from "./productView.js";
import { shopCardHtml, shopHref, shopLogoHtml } from "./shopView.js";
import { wishlistIds } from "./api/wishlistApi.js";
import { listCategories } from "./api/categoriesApi.js";
import { listProducts } from "./api/productsApi.js";
import { listFeaturedShops, listTopShops } from "./api/shopsApi.js";

const categoryRoot = document.querySelector("#category-row");
const trendingRoot = document.querySelector("#trending-grid");
const arrivalsRoot = document.querySelector("#arrivals-grid");
const featuredRoot = document.querySelector("#featured-shops");
const topRoot = document.querySelector("#top-stores");

if (trendingRoot) bindCatalogActions(trendingRoot);
if (arrivalsRoot) bindCatalogActions(arrivalsRoot);

mountShell({ page: "home" });
setupHero();
loadHome();

async function loadHome() {
  syncConfigBanner(isSupabaseConfigured());

  if (!isSupabaseConfigured()) {
    const message = "Set SUPABASE_URL and SUPABASE_ANON_KEY in web/js/config.js";
    endAll(message, true);
    return;
  }

  try {
    const [categories, trending, arrivals, featured, top, saved] = await Promise.all([
      listCategories(),
      listProducts({ sort: "trending", limit: 12, offset: 0 }),
      listProducts({ sort: "newest", limit: 12, offset: 0 }),
      listFeaturedShops(6),
      listTopShops(10),
      savedIds(),
    ]);

    renderCategories(categories);
    renderProducts(trendingRoot, trending.rows, saved, "No trending products yet.");
    renderProducts(arrivalsRoot, arrivals.rows, saved, "No new products yet.");
    renderFeatured(featured);
    renderTop(top);
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    endAll(message, true);
  }
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
 * @param {string} message
 * @param {boolean} retry
 */
function endAll(message, retry) {
  const onRetry = retry ? () => loadHome() : undefined;
  if (categoryRoot) showState(categoryRoot, escapeHtml(message), onRetry);
  if (trendingRoot) showState(trendingRoot, escapeHtml(message), onRetry);
  if (arrivalsRoot) showState(arrivalsRoot, escapeHtml(message), onRetry);
  if (featuredRoot) showState(featuredRoot, escapeHtml(message), onRetry);
  if (topRoot) showState(topRoot, escapeHtml(message), onRetry);
}

/**
 * @param {Array<{ id: string, parent_id: string | null, name: string, slug: string, image_url: string | null }>} categories
 */
function renderCategories(categories) {
  if (!categoryRoot) return;
  const roots = categories.filter((category) => !category.parent_id);
  const shown = (roots.length ? roots : categories).slice(0, 12);

  if (!shown.length) {
    showState(categoryRoot, "No active categories yet.");
    return;
  }

  categoryRoot.setAttribute("aria-busy", "false");
  categoryRoot.innerHTML = shown
    .map((category) => {
      const image = category.image_url
        ? `<img class="category-mark" src="${escapeHtml(category.image_url)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'category-mark\\'>${escapeHtml(category.name.slice(0, 1))}</span>'">`
        : `<span class="category-mark">${escapeHtml(category.name.slice(0, 1))}</span>`;
      return `
        <a class="category-card" href="${url("pages/products.html")}?category=${encodeURIComponent(category.slug)}">
          ${image}
          <h3>${escapeHtml(category.name)}</h3>
        </a>
      `;
    })
    .join("");
}

/**
 * @param {HTMLElement | null} root
 * @param {Array<object>} products
 * @param {Set<string>} saved
 * @param {string} emptyMessage
 */
function renderProducts(root, products, saved, emptyMessage) {
  if (!root) return;
  root.setAttribute("aria-busy", "false");
  if (!products.length) {
    showState(root, emptyMessage);
    return;
  }
  root.innerHTML = products
    .map((product) => productCardHtml(product, { saved: saved.has(product.id) }))
    .join("");
}

/**
 * @param {Array<object>} shops
 */
function renderFeatured(shops) {
  if (!featuredRoot) return;
  featuredRoot.setAttribute("aria-busy", "false");
  if (!shops.length) {
    showState(featuredRoot, "No approved stores yet.");
    return;
  }
  featuredRoot.innerHTML = shops
    .map((shop) => shopCardHtml(shop, { products: shop.products || [] }))
    .join("");
}

/**
 * @param {Array<object>} shops
 */
function renderTop(shops) {
  if (!topRoot) return;
  topRoot.setAttribute("aria-busy", "false");
  if (!shops.length) {
    showState(topRoot, "No approved stores yet.");
    return;
  }
  topRoot.innerHTML = shops
    .map((shop) => `
      <a class="top-store-card" href="${shopHref(shop.slug)}">
        ${shopLogoHtml(shop, "shop-logo-md")}
        <h3>${escapeHtml(shop.shop_name)}</h3>
        <p class="muted">${escapeHtml(String(shop.productCount))} products</p>
      </a>
    `)
    .join("");
}

function setupHero() {
  const track = document.querySelector("#hero-track");
  const dots = document.querySelector("#hero-dots");
  if (!track || !dots) return;

  const slides = [...track.children];
  let index = 0;

  const paint = () => {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.querySelectorAll("button").forEach((button, i) => {
      button.classList.toggle("is-active", i === index);
    });
  };

  dots.innerHTML = slides
    .map((_, i) => `<button type="button" aria-label="Slide ${i + 1}" class="${i === 0 ? "is-active" : ""}"></button>`)
    .join("");

  dots.querySelectorAll("button").forEach((button, i) => {
    button.addEventListener("click", () => {
      index = i;
      paint();
    });
  });

  document.querySelector("[data-hero='prev']")?.addEventListener("click", () => {
    index = (index - 1 + slides.length) % slides.length;
    paint();
  });
  document.querySelector("[data-hero='next']")?.addEventListener("click", () => {
    index = (index + 1) % slides.length;
    paint();
  });

  window.setInterval(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    index = (index + 1) % slides.length;
    paint();
  }, 6000);
}
