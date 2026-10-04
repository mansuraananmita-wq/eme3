/**
 * Shared product bottom sheet for reels (and later live).
 * Buy Now / Add to cart go through the cart only — never create an order.
 */

import { addToCart } from "../api/cartApi.js";
import { authErrorMessage } from "../auth.js?v=3";
import { toast } from "../components.js";
import { formatMoney } from "../format.js";
import { escapeHtml } from "../html.js";
import { url } from "../paths.js";

/**
 * @param {HTMLElement} host
 * @param {Array<object>} products
 * @param {{ title?: string, buyFocus?: boolean }} [options]
 */
export function openProductSheet(host, products, options = {}) {
  closeProductSheet(host);
  if (!products?.length) {
    toast("No products tagged on this reel.", "info");
    return;
  }

  const sheet = document.createElement("div");
  sheet.className = "reel-sheet";
  sheet.dataset.reelSheet = "products";
  sheet.innerHTML = `
    <div class="reel-sheet-backdrop" data-close-sheet></div>
    <div class="reel-sheet-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(options.title || "Products")}">
      <div class="reel-sheet-head">
        <h2>${escapeHtml(options.title || "Shop this reel")}</h2>
        <button class="icon-button reel-sheet-close" type="button" data-close-sheet aria-label="Close">×</button>
      </div>
      <div class="reel-sheet-list">
        ${products.map((product) => productRow(product)).join("")}
      </div>
    </div>
  `;

  host.append(sheet);
  sheet.querySelectorAll("[data-close-sheet]").forEach((node) => {
    node.addEventListener("click", () => closeProductSheet(host));
  });

  sheet.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = true;
      try {
        const result = await addToCart(button.getAttribute("data-add-cart") || "", 1);
        toast(
          result.capped ? `Only ${result.stock} in stock. Added that many.` : "Added to cart.",
          result.capped ? "info" : "success",
        );
      } catch (error) {
        toast(authErrorMessage(error), "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  // Buy Now: add to cart, then open the cart page (never creates an order).
  sheet.querySelectorAll("[data-buy-cart]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = true;
      try {
        const result = await addToCart(button.getAttribute("data-buy-cart") || "", 1);
        toast(
          result.capped ? `Only ${result.stock} in stock. Opening cart.` : "Added — opening cart.",
          result.capped ? "info" : "success",
        );
        closeProductSheet(host);
        window.location.assign(url("pages/cart.html"));
      } catch (error) {
        toast(authErrorMessage(error), "error");
        button.disabled = false;
      }
    });
  });

  if (options.buyFocus) {
    sheet.querySelector("[data-buy-cart]")?.focus();
  }
}

/**
 * @param {HTMLElement} host
 */
export function closeProductSheet(host) {
  host.querySelectorAll("[data-reel-sheet]").forEach((node) => node.remove());
}

/**
 * @param {object} product
 * @returns {string}
 */
function productRow(product) {
  const href = `${url("pages/product.html")}?slug=${encodeURIComponent(product.slug)}`;
  const img = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<span class="reel-product-fallback">${escapeHtml((product.title || "?").slice(0, 1))}</span>`;
  const stock = Number(product.stock) || 0;
  const price = formatMoney(product.price, product.currency);
  const compare = Number(product.compare_at_price);
  const showCompare = Number.isFinite(compare) && compare > Number(product.price);

  return `
    <article class="reel-product-row">
      <a class="reel-product-thumb" href="${href}">${img}</a>
      <div class="reel-product-copy">
        <a href="${href}"><strong>${escapeHtml(product.title)}</strong></a>
        <p>
          ${escapeHtml(price)}
          ${showCompare ? `<s>${escapeHtml(formatMoney(compare, product.currency))}</s>` : ""}
        </p>
        <div class="reel-product-actions">
          <button class="button button-primary" type="button" data-buy-cart="${escapeHtml(product.id)}" ${stock < 1 ? "disabled" : ""}>
            Buy Now
          </button>
          <button class="button button-ghost" type="button" data-add-cart="${escapeHtml(product.id)}" ${stock < 1 ? "disabled" : ""}>
            Add to cart
          </button>
        </div>
      </div>
    </article>
  `;
}
