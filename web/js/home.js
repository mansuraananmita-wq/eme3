/**
 * Home marketplace: hero, flash sale, promo rows, catalog sections.
 */

import { authErrorMessage, getCurrentProfile } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=16";
import { mountCarousel } from "./carousel.js";
import {
  HERO_BANNERS,
  MEDIUM_BANNERS,
  SIDE_BANNERS,
  flashSaleEndsAt,
  isBannerActive,
} from "./data/banners.js";
import { escapeHtml } from "./html.js";
import { t } from "./i18n.js?v=16";
import { maybeShowPromoPopup } from "./promoPopup.js";
import { isSupabaseConfigured } from "./supabaseClient.js";
import { url } from "./paths.js?v=4";
import { showState, syncConfigBanner } from "./ui-state.js";
import { bindCatalogActions, productCardHtml } from "./productView.js?v=9";
import { shopCardHtml, shopHref, shopLogoHtml } from "./shopView.js";
import { wishlistIds } from "./api/wishlistApi.js";
import { listCategories } from "./api/categoriesApi.js";
import { listDiscountedProducts, listProducts, listProductsByIds } from "./api/productsApi.js";
import { recentProductIds } from "./api/eventsApi.js";
import { listFeaturedShops } from "./api/shopsApi.js";
import { listPublishedReels } from "./api/reelsApi.js";
import { listLiveNow, listUpcomingLives } from "./api/liveApi.js";
import { formatMoney } from "./format.js";
import { icon } from "./icons.js";
import { pickProductImage, productImageUrl } from "./media.js";
import { shopOf } from "./shopView.js";

const categoryRoot = document.querySelector("#category-row");
const trendingRoot = document.querySelector("#trending-grid");
const forYouRoot = document.querySelector("#for-you-grid");
const forYouSection = document.querySelector("#for-you-section");
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
    const [categories, trending, arrivals, featured, reels, lives, upcoming, flash, saved] = await Promise.all([
      listCategories(),
      listProducts({ sort: "trending", limit: 12, offset: 0 }),
      listProducts({ sort: "newest", limit: 12, offset: 0 }),
      listFeaturedShops(6),
      listPublishedReels({ limit: 12, offset: 0, sort: "newest" }),
      listLiveNow({ limit: 8 }),
      listUpcomingLives({ limit: 8 }),
      listDiscountedProducts({ limit: 14 }),
      savedIds(),
    ]);

    renderHeroCats(categories);
    renderDealHero(flash, arrivals.rows);
    renderCategories(categories);
    renderFlash(flash, saved);
    renderProducts(trendingRoot, trending.rows, saved, t("noTrending"));
    await renderForYou(saved);
    renderProducts(arrivalsRoot, arrivals.rows, saved, t("noNewProducts"));
    renderFeatured(featured);
    renderLivesHome(lives, upcoming);
    renderReels(reels.rows);
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    endAll(message, true);
  }
}

/**
 * Products this browser opened recently.
 * @param {Set<string>} saved
 */
async function renderForYou(saved) {
  const ids = recentProductIds();
  if (!ids.length || !(forYouSection instanceof HTMLElement)) return;
  try {
    const rows = await listProductsByIds(ids);
    if (!rows.length) return;
    forYouSection.hidden = false;
    renderProducts(forYouRoot, rows, saved, "");
  } catch (error) {
    console.error("For you:", error);
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

/** @type {number} */
let dealTimer = 0;

/**
 * @param {Array<object>} deals
 * @param {Array<object>} arrivals
 */
function renderDealHero(deals, arrivals) {
  const main = document.querySelector("#deal-main");
  const arrival = document.querySelector("#deal-arrival");
  const slides = (deals.length ? deals : arrivals).slice(0, 4);
  if (main instanceof HTMLElement && slides.length) {
    let index = 0;
    const paint = () => {
      main.setAttribute("aria-busy", "false");
      main.innerHTML = dealMainHtml(slides[index]);
      cutoutHeroPhotos(main);
    };
    paint();
    if (dealTimer) window.clearInterval(dealTimer);
    if (slides.length > 1) {
      dealTimer = window.setInterval(() => {
        index = (index + 1) % slides.length;
        paint();
      }, 6000);
    }
  }
  const fresh = arrivals[0];
  if (arrival instanceof HTMLElement && fresh) {
    arrival.innerHTML = arrivalHtml(fresh);
    cutoutHeroPhotos(arrival);
  }
}

/**
 * @param {object} product
 * @returns {number | null}
 */
function discountOf(product) {
  const compare = Number(product.compare_at_price);
  const current = Number(product.price);
  if (!Number.isFinite(compare) || !Number.isFinite(current) || compare <= current) return null;
  return Math.round(((compare - current) / compare) * 100);
}

/**
 * @param {object} product
 * @returns {string}
 */
function heroImage(product) {
  const image = pickProductImage(product.product_images);
  const src = image ? productImageUrl(image.storage_path) : "";
  if (!src) return "";
  return `<img data-cutout src="${escapeHtml(src)}" alt="" crossorigin="anonymous" onerror="this.hidden=true">`;
}

/**
 * Lifts a product off a flat studio background so it sits on the card.
 * @param {ParentNode} root
 */
function cutoutHeroPhotos(root) {
  root.querySelectorAll("img[data-cutout]").forEach((node) => {
    if (!(node instanceof HTMLImageElement)) return;
    const start = () => {
      isolateProduct(node).catch((error) => {
        console.error("Hero cutout:", error);
        node.removeAttribute("data-cutout");
      });
    };
    if (node.complete && node.naturalWidth) start();
    else node.addEventListener("load", start, { once: true });
  });
}

const SCENE_REMOVAL_URL = "https://esm.sh/@imgly/background-removal@1.7.0";

/** @type {Map<string, string | null>} */
const sceneCutouts = new Map();

/** @type {Map<string, Promise<string | null>>} */
const sceneJobs = new Map();

/** @type {Promise<unknown>} */
let sceneChain = Promise.resolve();

/** @type {Promise<{ removeBackground: Function }> | null} */
let sceneModule = null;

/**
 * @param {HTMLImageElement} img
 * @returns {Promise<void>}
 */
async function isolateProduct(img) {
  if (!img.hasAttribute("data-cutout")) return;
  try {
    const source = img.currentSrc || img.src;
    if (sceneCutouts.has(source)) {
      const cached = sceneCutouts.get(source);
      if (cached) applyCutoutUrl(img, cached);
      else img.removeAttribute("data-cutout");
      return;
    }
    const loaded = await loadHeroImage(source);
    const maxEdge = 720;
    const scale = Math.min(1, maxEdge / Math.max(loaded.naturalWidth, loaded.naturalHeight));
    const width = Math.max(1, Math.round(loaded.naturalWidth * scale));
    const height = Math.max(1, Math.round(loaded.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      img.removeAttribute("data-cutout");
      return;
    }
    context.drawImage(loaded, 0, 0, width, height);
    const frame = context.getImageData(0, 0, width, height);
    const removed = clearStudioBackground(frame.data, width, height);
    const total = width * height;
    if (removed >= total * 0.12 && removed <= total * 0.93) {
      context.putImageData(frame, 0, 0);
      const cropped = cropToSubject(canvas, frame.data, width, height);
      if (cropped) {
        applyCutoutUrl(img, cropped.toDataURL("image/png"));
        return;
      }
    }
    img.removeAttribute("data-cutout");
    const cutout = await sceneCutoutFor(source, loaded);
    if (cutout && img.isConnected) applyCutoutUrl(img, cutout);
  } catch (error) {
    console.error("Hero cutout:", error);
    img.removeAttribute("data-cutout");
  }
}

/**
 * @param {HTMLImageElement} img
 * @param {string} dataUrl
 */
function applyCutoutUrl(img, dataUrl) {
  img.classList.add("is-cutout");
  img.onload = () => img.removeAttribute("data-cutout");
  img.src = dataUrl;
}

/**
 * Room and wood-floor photos fail the flat-studio flood fill.
 * A browser model lifts the product; the framed photo stays up until it finishes.
 * @param {string} source
 * @param {HTMLImageElement} loaded
 * @returns {Promise<string | null>}
 */
function sceneCutoutFor(source, loaded) {
  if (sceneCutouts.has(source)) return Promise.resolve(sceneCutouts.get(source) || null);
  const pending = sceneJobs.get(source);
  if (pending) return pending;

  const job = sceneChain.then(() => runSceneCutout(source, loaded));
  sceneJobs.set(source, job);
  sceneChain = job.then(() => undefined, () => undefined);
  return job;
}

/**
 * @param {string} source
 * @param {HTMLImageElement} loaded
 * @returns {Promise<string | null>}
 */
async function runSceneCutout(source, loaded) {
  try {
    if (!sceneModule) sceneModule = import(SCENE_REMOVAL_URL);
    const mod = await sceneModule;
    const blob = await imageToBlob(loaded);
    if (!blob) return null;
    const cut = await withTimeout(mod.removeBackground(blob, {
      device: "cpu",
      model: "isnet_quint8",
      output: { format: "image/png", quality: 0.8 },
    }), 60000);
    const url = await transparentPngUrl(cut);
    sceneCutouts.set(source, url);
    return url;
  } catch (error) {
    console.error("Scene cutout:", error);
    sceneCutouts.set(source, null);
    return null;
  }
}

/**
 * @param {Promise<Blob>} promise
 * @param {number} ms
 * @returns {Promise<Blob>}
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Cutout timed out.")), ms);
    promise.then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    }, (error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * @param {HTMLImageElement} image
 * @returns {Promise<Blob | null>}
 */
function imageToBlob(image) {
  const maxEdge = 640;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
  });
}

/**
 * @param {Blob} blob
 * @returns {Promise<string | null>}
 */
async function transparentPngUrl(blob) {
  const image = await blobToImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  let clear = 0;
  for (let index = 3; index < frame.data.length; index += 4) {
    if (frame.data[index] < 16) clear += 1;
  }
  const total = canvas.width * canvas.height;
  if (clear < total * 0.12 || clear > total * 0.93) return null;
  const cropped = cropToSubject(canvas, frame.data, canvas.width, canvas.height);
  return cropped ? cropped.toDataURL("image/png") : null;
}

/**
 * @param {Blob} blob
 * @returns {Promise<HTMLImageElement>}
 */
function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  return loadHeroImage(url).finally(() => URL.revokeObjectURL(url));
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadHeroImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Hero image failed to load."));
    image.src = src;
  });
}

/**
 * Clears the flat color connected to the photo edges (black, white, or gray studio).
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
function clearStudioBackground(data, width, height) {
  const background = borderColor(data, width, height);
  if (!studioBorder(data, width, height, background)) return 0;
  const luminance = (background[0] + background[1] + background[2]) / 3;
  // Tight on purpose: a wide match eats the product's own shadow and leaves a hole.
  const threshold = luminance < 90 ? 22 : 16;
  const seen = new Uint8Array(width * height);
  /** @type {number[]} */
  const queue = [];
  let head = 0;

  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (seen[index]) return;
    seen[index] = 1;
    const offset = index * 4;
    const distance = Math.hypot(
      data[offset] - background[0],
      data[offset + 1] - background[1],
      data[offset + 2] - background[2],
    );
    if (distance > threshold) return;
    data[offset + 3] = 0;
    queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    visit(0, y);
    visit(width - 1, y);
  }

  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = (index - x) / width;
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }

  let removed = 0;
  for (let index = 0; index < width * height; index += 1) {
    if (data[index * 4 + 3] === 0) removed += 1;
  }
  return removed;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement | null}
 */
function cropToSubject(canvas, data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const pad = Math.round(Math.max(width, height) * 0.04);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  if (cropWidth * cropHeight < width * height * 0.06) return null;
  const cropped = document.createElement("canvas");
  cropped.width = cropWidth;
  cropped.height = cropHeight;
  cropped.getContext("2d")?.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return cropped;
}

/**
 * True when the photo edge is one flat studio color, so it can be lifted off the card.
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {[number, number, number]} background
 * @returns {boolean}
 */
function studioBorder(data, width, height, background) {
  const target = background[0] + background[1] + background[2];
  let total = 0;
  let close = 0;
  const take = (x, y) => {
    const offset = (y * width + x) * 4;
    const sum = data[offset] + data[offset + 1] + data[offset + 2];
    total += 1;
    if (Math.abs(sum - target) < 48) close += 1;
  };
  const stepX = Math.max(1, Math.floor(width / 48));
  const stepY = Math.max(1, Math.floor(height / 48));
  for (let x = 0; x < width; x += stepX) {
    take(x, 0);
    take(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    take(0, y);
    take(width - 1, y);
  }
  return total > 0 && close / total >= 0.88;
}

/**
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @returns {[number, number, number]}
 */
function borderColor(data, width, height) {
  /** @type {Array<[number, number, number]>} */
  const samples = [];
  const take = (x, y) => {
    const offset = (y * width + x) * 4;
    samples.push([data[offset], data[offset + 1], data[offset + 2]]);
  };
  const stepX = Math.max(1, Math.floor(width / 48));
  const stepY = Math.max(1, Math.floor(height / 48));
  for (let x = 0; x < width; x += stepX) {
    take(x, 0);
    take(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    take(0, y);
    take(width - 1, y);
  }
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  return samples[Math.floor(samples.length / 2)] || [0, 0, 0];
}

/**
 * @param {object} product
 * @returns {string}
 */
function dealMainHtml(product) {
  const href = `${url("pages/product.html")}?slug=${encodeURIComponent(product.slug)}`;
  const discount = discountOf(product);
  const shop = shopOf(product)?.shop_name || "";
  return `
    <div class="deal-copy">
      <p class="deal-kicker">${escapeHtml(t("weeklyDrop"))}</p>
      <h2>${escapeHtml(product.title)}</h2>
      ${discount != null ? `<span class="deal-badge">${escapeHtml(t("uptoOff"))} ${discount}% ${escapeHtml(t("off"))}</span>` : ""}
      <p class="deal-note">${escapeHtml(shop ? `${t("approvedShopLine")} · ${shop}` : t("approvedShopLine"))}</p>
      <p class="deal-price">${escapeHtml(formatMoney(product.price, product.currency))}</p>
      <a class="deal-cta" href="${href}">${escapeHtml(t("shopNow"))}</a>
    </div>
    <div class="deal-photo">${heroImage(product)}</div>
  `;
}

/**
 * @param {object} product
 * @returns {string}
 */
function arrivalHtml(product) {
  const href = `${url("pages/product.html")}?slug=${encodeURIComponent(product.slug)}`;
  return `
    <div class="deal-copy">
      <p class="deal-kicker">${escapeHtml(t("justLanded"))}</p>
      <h3>${escapeHtml(product.title)}</h3>
      <p class="deal-price">${escapeHtml(formatMoney(product.price, product.currency))}</p>
      <a class="deal-cta" href="${href}">${escapeHtml(t("shopNow"))}</a>
    </div>
    <div class="deal-photo">${heroImage(product)}</div>
  `;
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
      flashCountdown.textContent = t("ended");
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
    showState(featuredRoot, t("noStores"));
    return;
  }
  featuredRoot.innerHTML = shops
    .map((shop) => shopCardHtml(shop, { products: shop.products || [] }))
    .join("");
}

/**
 * @param {Array<object>} lives
 * @param {Array<object>} upcoming
 */
function renderLivesHome(lives, upcoming) {
  if (!(livesHomeSection instanceof HTMLElement) || !(livesHomeRow instanceof HTMLElement)) return;
  const heading = livesHomeSection.querySelector("h2");
  const liveCards = lives.map((stream) => liveThumb(stream, "live"));
  const soonCards = upcoming.map((stream) => liveThumb(stream, "upcoming"));
  const cards = [...liveCards, ...soonCards];
  if (heading) heading.textContent = lives.length ? t("liveNowTitle") : t("upcomingLives");
  if (!cards.length) {
    livesHomeSection.hidden = false;
    livesHomeRow.setAttribute("aria-busy", "false");
    livesHomeRow.innerHTML = `<p class="muted">${escapeHtml(t("noLiveHome"))}</p>`;
    return;
  }
  livesHomeSection.hidden = false;
  livesHomeRow.setAttribute("aria-busy", "false");
  livesHomeRow.className = "live-thumb-row";
  livesHomeRow.innerHTML = cards.join("");
}

/**
 * Portrait live card, same shape as a reel thumb.
 * @param {object} stream
 * @param {"live" | "upcoming"} mode
 * @returns {string}
 */
function liveThumb(stream, mode) {
  const href = `${url("pages/live.html")}?id=${encodeURIComponent(stream.id)}`;
  const shopName = stream.shop?.shop_name || stream.title || "Live";
  const thumb = stream.thumbnailUrl
    ? `<img src="${escapeHtml(stream.thumbnailUrl)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<span class="live-thumb-fallback">${escapeHtml(shopName.slice(0, 1))}</span>`;
  const when = stream.scheduledAt ? formatWhen(stream.scheduledAt) : "";
  const badge = mode === "live" ? "LIVE" : (when || t("upcomingLives"));
  return `
    <a class="live-thumb" href="${href}">
      ${thumb}
      <span class="live-thumb-badge${mode === "upcoming" ? " is-soon" : ""}">${escapeHtml(badge)}</span>
      <span class="live-thumb-play" aria-hidden="true">${icon("play")}</span>
      <span class="live-thumb-label">${escapeHtml(shopName)}</span>
    </a>
  `;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
