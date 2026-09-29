import { escapeHtml } from "./html.js";
import { pickProductImage, productImageUrl } from "./media.js";
import { url } from "./paths.js";

/**
 * @param {object | null | undefined} product
 * @returns {object | null}
 */
export function shopOf(product) {
  const shop = product?.vendor_profiles;
  if (Array.isArray(shop)) return shop[0] || null;
  return shop || null;
}

/**
 * @param {string | null | undefined} slug
 * @returns {string}
 */
export function shopHref(slug) {
  if (!slug) return url("pages/shops.html");
  return `${url("pages/shop.html")}?slug=${encodeURIComponent(slug)}`;
}

/**
 * Small circular shop mark for cards and seller rows.
 * @param {{ shop_name?: string, logo_url?: string | null } | null | undefined} shop
 * @param {string} [sizeClass]
 * @returns {string}
 */
export function shopLogoHtml(shop, sizeClass = "shop-logo") {
  const name = shop?.shop_name || "Shop";
  const letter = name.slice(0, 1);
  if (shop?.logo_url) {
    return `
      <img class="${sizeClass}" src="${escapeHtml(shop.logo_url)}" alt="" loading="lazy"
        onerror="this.hidden=true;this.nextElementSibling.hidden=false">
      <span class="${sizeClass} shop-logo-fallback" hidden>${escapeHtml(letter)}</span>
    `;
  }
  return `<span class="${sizeClass} shop-logo-fallback">${escapeHtml(letter)}</span>`;
}

/**
 * "Sold by Store" link used on product cards.
 * @param {object | null | undefined} product
 * @returns {string}
 */
export function soldByHtml(product) {
  const shop = shopOf(product);
  if (!shop) return `<p class="sold-by muted">Sold by a marketplace seller</p>`;
  return `
    <a class="sold-by" href="${shopHref(shop.slug)}">
      ${shopLogoHtml(shop, "shop-logo-xs")}
      <span>Sold by <strong>${escapeHtml(shop.shop_name)}</strong></span>
    </a>
  `;
}

/**
 * Store directory / featured card.
 * @param {object} shop
 * @param {{ products?: Array<object> }} [options]
 * @returns {string}
 */
export function shopCardHtml(shop, options = {}) {
  const products = options.products || [];
  const thumbs = products
    .map((product) => {
      const image = pickProductImage(product.product_images);
      const src = image ? productImageUrl(image.storage_path) : "";
      if (!src) return `<span class="thumb-fallback"></span>`;
      return `<img src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'thumb-fallback'}))">`;
    })
    .join("");

  const thumbRow = products.length
    ? `<div class="shop-thumbs">${thumbs}</div>`
    : "";

  const banner = shop.banner_url
    ? `<img class="shop-card-banner" src="${escapeHtml(shop.banner_url)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<div class="shop-card-banner shop-card-banner-empty"></div>`;

  return `
    <article class="shop-card-panel">
      <a class="shop-card-banner-link" href="${shopHref(shop.slug)}">${banner}</a>
      <div class="shop-card-body">
        <a class="shop-card-identity" href="${shopHref(shop.slug)}">
          ${shopLogoHtml(shop, "shop-logo-md")}
          <div>
            <h3>${escapeHtml(shop.shop_name)}</h3>
            <p class="muted">${escapeHtml(String(shop.productCount ?? 0))} products</p>
          </div>
        </a>
        <p class="shop-card-desc">${escapeHtml(shop.description || "Independent seller on EME.")}</p>
        ${thumbRow}
        <a class="button button-primary" href="${shopHref(shop.slug)}">Visit store</a>
      </div>
    </article>
  `;
}
