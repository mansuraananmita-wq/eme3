/**
 * Home marketplace: hero, flash sale, promo rows, catalog sections.
 */

import { authErrorMessage, getCurrentProfile } from "./auth.js";
import { mountShell, toast } from "./components.js";
import { mountCarousel } from "./carousel.js";
import {
  HERO_BANNERS,
  MEDIUM_BANNERS,
  SIDE_BANNERS,
  flashSaleEndsAt,
  isBannerActive,
} from "./data/banners.js";
import { escapeHtml } from "./html.js";
import { maybeShowPromoPopup } from "./promoPopup.js";
import { isSupabaseConfigured } from "./supabaseClient.js";
import { url } from "./paths.js";
import { showState, syncConfigBanner } from "./ui-state.js";
import { bindCatalogActions, productCardHtml } from "./productView.js";
import { shopCardHtml, shopHref, shopLogoHtml } from "./shopView.js";
import { wishlistIds } from "./api/wishlistApi.js";
import { listCategories } from "./api/categoriesApi.js";
import { listDiscountedProducts, listProducts } from "./api/productsApi.js";
import { listFeaturedShops } from "./api/shopsApi.js";
import { listPublishedReels } from "./api/reelsApi.js";
import { listLiveNow } from "./api/liveApi.js";
import { formatMoney } from "./format.js";
import { icon } from "./icons.js";

const categoryRoot = document.querySelector("#category-row");
const trendingRoot = document.querySelector("#trending-grid");
const arrivalsRoot = document.querySelector("#arrivals-grid");
const featuredRoot = document.querySelector("#featured-shops");
const reelsRoot = document.querySelector("#reels-row");
const livesHomeSection = document.querySelector("#lives-home-section");
const livesHomeRow = document.querySelector("#lives-home-row");
const flashSection = document.querySelector("#flash-section");
const flashRail = document.querySelector("#flash-rail");
const heroCats = document.querySelector("#hero-cats");
const heroTrack = document.querySelector("#hero-track");
const heroSide = document.querySelector("#hero-side");
const promoRow = document.querySelector("#promo-row");
const flashCountdown = document.querySelector("#flash-countdown");

if (trendingRoot) bindCatalogActions(trendingRoot);
if (arrivalsRoot) bindCatalogActions(arrivalsRoot);
if (flashRail instanceof HTMLElement) bindCatalogActions(flashRail);

mountShell({ page: "home" });
renderStaticBanners();
loadHome();
window.setTimeout(() => maybeShowPromoPopup(), 1200);

async function loadHome() {
  syncConfigBanner(isSupabaseConfigured());

  if (!isSupabaseConfigured()) {
    const message = "Set SUPABASE_URL and SUPABASE_ANON_KEY in web/js/config.js";
    endAll(message, true);
    return;
  }

  try {
    const [categories, trending, arrivals, featured, reels, lives, flash, saved] = await Promise.all([
      listCategories(),
      listProducts({ sort: "trending", limit: 12, offset: 0 }),
      listProducts({ sort: "newest", limit: 12, offset: 0 }),
      listFeaturedShops(6),
      listPublishedReels({ limit: 12, offset: 0, sort: "newest" }),
      listLiveNow({ limit: 12 }),
      listDiscountedProducts({ limit: 14 }),
      savedIds(),
    ]);

    renderHeroCats(categories);
    renderCategories(categories);
    renderFlash(flash, saved);
    renderProducts(trendingRoot, trending.rows, saved, "No trending products yet.");
    renderProducts(arrivalsRoot, arrivals.rows, saved, "No new products yet.");
    renderFeatured(featured);
    renderLivesHome(lives);
    renderReels(reels.rows);
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
  if (reelsRoot) showState(reelsRoot, escapeHtml(message), onRetry);
  if (livesHomeRow) showState(livesHomeRow, escapeHtml(message), onRetry);
  if (flashRail) showState(flashRail, escapeHtml(message), onRetry);
  if (heroCats) showState(heroCats, escapeHtml(message), onRetry);
}

function renderStaticBanners() {
  const heroes = HERO_BANNERS.filter((banner) => isBannerActive(banner));
  const sides = SIDE_BANNERS.filter((banner) => isBannerActive(banner));
  const mediums = MEDIUM_BANNERS.filter((banner) => isBannerActive(banner));

  if (heroTrack instanceof HTMLElement) {
    heroTrack.setAttribute("aria-busy", "false");
    heroTrack.innerHTML = heroes.map((banner, index) => `
      <a class="hero-slide-banner" href="${url(banner.href)}" aria-label="${escapeHtml(banner.alt || banner.title)}">
        <img
          src="${escapeHtml(url(banner.image))}"
          alt="${escapeHtml(banner.alt || banner.title)}"
          width="1200"
          height="400"
          ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
          onerror="this.classList.add('is-broken');this.removeAttribute('alt');"
        >
      </a>
    `).join("");

    const carousel = document.querySelector("#hero-carousel");
    if (carousel instanceof HTMLElement) mountCarousel(carousel, { intervalMs: 5000 });
  }

  if (heroSide instanceof HTMLElement) {
    heroSide.innerHTML = sides.map((banner) => `
      <a class="hero-side-card" href="${url(banner.href)}" aria-label="${escapeHtml(banner.alt || banner.title)}">
        <img
          src="${escapeHtml(url(banner.image))}"
          alt="${escapeHtml(banner.alt || banner.title)}"
          width="400"
          height="190"
          loading="lazy"
          onerror="this.classList.add('is-broken');this.removeAttribute('alt');"
        >
      </a>
    `).join("");
  }

  if (promoRow instanceof HTMLElement) {
    promoRow.innerHTML = mediums.map((banner) => `
      <a class="promo-card" href="${url(banner.href)}" aria-label="${escapeHtml(banner.alt || banner.title)}">
        <img
          src="${escapeHtml(url(banner.image))}"
          alt="${escapeHtml(banner.alt || banner.title)}"
          width="600"
          height="300"
          loading="lazy"
          onerror="this.classList.add('is-broken');this.removeAttribute('alt');"
        >
      </a>
    `).join("");
  }
}

/**
 * @param {Array<{ id: string, parent_id: string | null, name: string, slug: string }>} categories
 */
function renderHeroCats(categories) {
  if (!(heroCats instanceof HTMLElement)) return;
  const roots = categories.filter((row) => !row.parent_id).slice(0, 10);
  heroCats.setAttribute("aria-busy", "false");
  if (!roots.length) {
    heroCats.innerHTML = "";
    return;
  }
  heroCats.innerHTML = `
    <ul class="hero-cat-list">
      ${roots.map((row) => {
        const kids = categories.filter((c) => c.parent_id === row.id);
        return `
          <li>
            <a href="${url("pages/products.html")}?category=${encodeURIComponent(row.slug)}">
              <span>${escapeHtml(row.name)}</span>
              ${kids.length ? `<span class="hero-cat-arrow" aria-hidden="true">›</span>` : ""}
            </a>
          </li>
        `;
      }).join("")}
    </ul>
  `;
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
        ? `<img src="${escapeHtml(category.image_url)}" alt="" loading="lazy" onerror="this.remove()">`
        : "";
      const letter = escapeHtml(category.name.slice(0, 1));
      return `
        <a class="category-icon-card" href="${url("pages/products.html")}?category=${encodeURIComponent(category.slug)}">
          <span class="category-icon-mark">${image || `<span>${letter}</span>`}</span>
          <span>${escapeHtml(category.name)}</span>
        </a>
      `;
    })
    .join("");
}

/**
 * @param {Array<object>} products
 * @param {Set<string>} saved
 */
function renderFlash(products, saved) {
  if (!(flashSection instanceof HTMLElement) || !(flashRail instanceof HTMLElement)) return;

  if (!products.length) {
    flashSection.hidden = true;
    flashSection.classList.add("is-hidden");
    return;
  }

  flashSection.hidden = false;
  flashSection.classList.remove("is-hidden");
  flashRail.setAttribute("aria-busy", "false");
  flashRail.innerHTML = products
    .map((product) => productCardHtml(product, { saved: saved.has(product.id), flash: true }))
    .join("");

  startFlashCountdown();
}

function startFlashCountdown() {
  if (!(flashCountdown instanceof HTMLElement)) return;
  const ends = flashSaleEndsAt();

  const tick = () => {
    const diff = ends.getTime() - Date.now();
    if (diff <= 0) {
      flashCountdown.textContent = "Ended";
      return;
    }
    const hours = Math.floor(diff / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    const secs = Math.floor((diff % 60_000) / 1000);
    flashCountdown.innerHTML = `
      <span class="sr-only">Ends in ${hours} hours ${mins} minutes ${secs} seconds</span>
      <span aria-hidden="true"><b>${String(hours).padStart(2, "0")}</b>:<b>${String(mins).padStart(2, "0")}</b>:<b>${String(secs).padStart(2, "0")}</b></span>
    `;
  };

  tick();
  window.setInterval(tick, 1000);
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
 * @param {Array<object>} lives
 */
function renderLivesHome(lives) {
  if (!(livesHomeSection instanceof HTMLElement) || !(livesHomeRow instanceof HTMLElement)) return;
  if (!lives.length) {
    livesHomeSection.hidden = false;
    livesHomeRow.setAttribute("aria-busy", "false");
    livesHomeRow.innerHTML = `<p class="muted">No shop is live right now. A live shop shows here the same way reels do.</p>`;
    return;
  }
  livesHomeSection.hidden = false;
  livesHomeRow.setAttribute("aria-busy", "false");
  livesHomeRow.className = "live-thumb-row";
  livesHomeRow.innerHTML = lives.map((stream) => liveThumb(stream)).join("");
}

/**
 * Portrait live card, same shape as a reel thumb.
 * @param {object} stream
 * @returns {string}
 */
function liveThumb(stream) {
  const href = `${url("pages/live.html")}?id=${encodeURIComponent(stream.id)}`;
  const shopName = stream.shop?.shop_name || stream.title || "Live";
  const thumb = stream.thumbnailUrl
    ? `<img src="${escapeHtml(stream.thumbnailUrl)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<span class="live-thumb-fallback">${escapeHtml(shopName.slice(0, 1))}</span>`;
  return `
    <a class="live-thumb" href="${href}">
      ${thumb}
      <span class="live-thumb-badge">LIVE</span>
      <span class="live-thumb-play" aria-hidden="true">${icon("play")}</span>
      <span class="live-thumb-label">${escapeHtml(shopName)}</span>
    </a>
  `;
}

/**
 * @param {Array<object>} reels
 */
function renderReels(reels) {
  if (!reelsRoot) return;
  reelsRoot.setAttribute("aria-busy", "false");
  if (!reels.length) {
    showState(reelsRoot, "No published reels yet.");
    return;
  }
  reelsRoot.innerHTML = reels
    .map((reel) => {
      const product = reel.products?.[0];
      const thumbSrc = reel.thumbnailUrl || product?.imageUrl || "";
      const thumb = thumbSrc
        ? `<img src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" onerror="this.hidden=true">`
        : "";
      const label = reel.shop?.shop_name || "Reel";
      const price = product
        ? formatMoney(product.price, product.currency)
        : "";
      return `
        <a class="reel-thumb-card" href="${url("pages/reels.html")}?start=${encodeURIComponent(reel.id)}">
          ${thumb}
          <span class="reel-thumb-label">${escapeHtml(label)}</span>
          <span class="reel-thumb-play" aria-hidden="true">${icon("play")}</span>
          ${price ? `<span class="reel-thumb-price">${escapeHtml(price)}</span>` : ""}
        </a>
      `;
    })
    .join("");
}
