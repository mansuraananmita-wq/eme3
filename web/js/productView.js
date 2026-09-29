import { addToCart } from "./api/cartApi.js";
import { addWishlist, removeWishlist } from "./api/wishlistApi.js";
import { authErrorMessage, getCurrentProfile } from "./auth.js";
import { toast } from "./components.js";
import { escapeHtml } from "./html.js";
import { formatMoney } from "./format.js";
import { icon } from "./icons.js";
import { pickProductImage, productImageUrl } from "./media.js";
import { loginRedirect, url } from "./paths.js";
import { shopOf, soldByHtml } from "./shopView.js";

/**
 * @param {object | null | undefined} product
 * @returns {string}
 */
export function shopName(product) {
  return shopOf(product)?.shop_name || "Shop";
}

/**
 * @param {object} product
 * @returns {number | null}
 */
function discountPercent(product) {
  const compare = Number(product.compare_at_price);
  const current = Number(product.price);
  if (!Number.isFinite(compare) || !Number.isFinite(current) || compare <= current || current < 0) {
    return null;
  }
  return Math.round(((compare - current) / compare) * 100);
}

/**
 * @param {object} product
 * @returns {string}
 */
export function priceHtml(product) {
  const price = formatMoney(product.price, product.currency);
  const compare = Number(product.compare_at_price);
  const current = Number(product.price);
  const was = Number.isFinite(compare) && compare > current
    ? `<s>${escapeHtml(formatMoney(product.compare_at_price, product.currency))}</s>`
    : "";
  return `<span class="price">${escapeHtml(price)} ${was}</span>`;
}

/**
 * @param {object} product
 * @returns {string}
 */
export function productHref(product) {
  return `${url("pages/product.html")}?slug=${encodeURIComponent(product.slug)}`;
}

/**
 * @param {object | null | undefined} product
 * @returns {string}
 */
export function imageHtml(product) {
  const image = pickProductImage(product?.product_images);
  const src = image ? productImageUrl(image.storage_path) : "";
  const letter = product?.title ? product.title.slice(0, 1) : "?";
  if (src) {
    return `
      <img src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
      <span class="product-fallback" hidden>${escapeHtml(letter)}</span>
    `;
  }
  return `<span class="product-fallback">${escapeHtml(letter)}</span>`;
}

/**
 * Catalog card with seller link, wishlist, and add-to-cart.
 * @param {object} product
 * @param {{ saved?: boolean }} [options]
 * @returns {string}
 */
export function productCardHtml(product, options = {}) {
  const saved = options.saved ? "is-saved" : "";
  const pressed = options.saved ? "true" : "false";
  const discount = discountPercent(product);
  return `
    <article class="product-card">
      <a class="product-media" href="${productHref(product)}">
        ${discount != null ? `<span class="discount-badge">-${discount}%</span>` : ""}
        ${imageHtml(product)}
      </a>
      <button class="icon-button wish-on-image ${saved}" type="button" data-wishlist="${escapeHtml(product.id)}" aria-pressed="${pressed}" aria-label="Save ${escapeHtml(product.title)}">
        ${icon("heart")}
      </button>
      <div class="product-copy">
        ${soldByHtml(product)}
        <h3><a href="${productHref(product)}">${escapeHtml(product.title)}</a></h3>
        ${priceHtml(product)}
        <div class="card-actions">
          <button class="button button-primary" type="button" data-add-cart="${escapeHtml(product.id)}">Add to cart</button>
        </div>
      </div>
    </article>
  `;
}

/**
 * @param {HTMLElement} root
 * @param {() => void} [onChange]
 */
export function bindCatalogActions(root, onChange) {
  if (root.dataset.catalogBound === "1") return;
  root.dataset.catalogBound = "1";

  root.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const wish = target?.closest("[data-wishlist]");
    const add = target?.closest("[data-add-cart]");
    if (!wish && !add) return;

    const button = wish || add;
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = true;

    try {
      if (wish) {
        const profile = await getCurrentProfile();
        if (!profile) {
          window.location.assign(loginRedirect());
          return;
        }
        const productId = wish.getAttribute("data-wishlist") || "";
        const saved = wish.getAttribute("aria-pressed") === "true";
        if (saved) await removeWishlist(productId);
        else await addWishlist(productId);
        wish.classList.toggle("is-saved", !saved);
        wish.setAttribute("aria-pressed", saved ? "false" : "true");
        toast(saved ? "Removed from wishlist." : "Saved to wishlist.", "success");
      } else if (add) {
        const result = await addToCart(add.getAttribute("data-add-cart") || "", 1);
        toast(
          result.capped ? `Only ${result.stock} in stock. Added that many.` : "Added to cart.",
          result.capped ? "info" : "success",
        );
      }
      onChange?.();
    } catch (error) {
      toast(authErrorMessage(error), "error");
    } finally {
      button.disabled = false;
    }
  });
}
