import { listReviews, canReviewProduct, getProduct, productsFromShop, relatedProducts, saveReview } from "./api/productsApi.js";
import { getShop } from "./api/shopsApi.js";
import { followShop, followedShopIds, unfollowShop } from "./api/reelsApi.js";
import { addToCart } from "./api/cartApi.js";
import { recordCatalogEvent } from "./api/eventsApi.js";
import { setBuyNow } from "./api/checkoutApi.js";
import { addWishlist, removeWishlist, wishlistIds } from "./api/wishlistApi.js";
import { authErrorMessage, getCurrentProfile } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=16";
import { escapeHtml } from "./html.js";
import { pickProductImage, productImageUrl } from "./media.js";
import { loginRedirect, url } from "./paths.js?v=4";
import { bindCatalogActions, priceHtml, productCardHtml } from "./productView.js?v=9";
import { shopHref, shopLogoHtml, shopOf, soldByHtml } from "./shopView.js";
import { showState } from "./ui-state.js";
import { t } from "./i18n.js?v=16";

mountShell({ page: "product" });

const root = document.querySelector("#product-root");
const sellerRoot = document.querySelector("#seller-card");
const moreRoot = document.querySelector("#more-from-store");
const reviewRoot = document.querySelector("#reviews");
const relatedRoot = document.querySelector("#related");

if (moreRoot) bindCatalogActions(moreRoot);
if (relatedRoot) bindCatalogActions(relatedRoot);

load();

async function load() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const slug = params.get("slug");

  if (!id && !slug) {
    showMissing("Choose a product from the shop.");
    return;
  }

  try {
    const product = await getProduct({ id, slug });
    if (!product) {
      showMissing("This product is not available.");
      return;
    }

    document.title = `${product.title} — EME`;
    recordCatalogEvent("view", "product", product.id);
    const saved = await isSaved(product.id);
    renderProduct(product, saved);
    await renderSeller(product);
    await Promise.all([
      renderMoreFromStore(product),
      renderReviews(product),
      renderRelated(product),
    ]);
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showMissing(message);
  }
}

/**
 * @param {string} message
 */
function showMissing(message) {
  if (root) showState(root, escapeHtml(message));
  if (sellerRoot) sellerRoot.innerHTML = "";
  if (moreRoot) moreRoot.innerHTML = "";
  if (reviewRoot) reviewRoot.innerHTML = "";
  if (relatedRoot) relatedRoot.innerHTML = "";
}

/**
 * @param {string} productId
 * @returns {Promise<boolean>}
 */
async function isSaved(productId) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return false;
    const ids = await wishlistIds();
    return ids.has(productId);
  } catch {
    return false;
  }
}

/**
 * @param {object} product
 * @param {boolean} saved
 */
function renderProduct(product, saved) {
  if (!root) return;
  const images = sortImages(product.product_images);
  const stock = Number(product.stock) || 0;
  const inStock = stock > 0;
  const rating = Number(product.avg_rating);
  const ratingText = Number.isFinite(rating) ? rating.toFixed(1) : "0.0";

  root.innerHTML = `
    <div class="detail">
      <div class="gallery">
        <div class="gallery-main" id="gallery-main">${galleryMain(images, product.title)}</div>
        <div class="thumbs" id="gallery-thumbs">
          ${images.map((image, index) => `
            <button type="button" class="${index === 0 ? "is-active" : ""}" data-index="${index}" aria-label="Image ${index + 1}">
              <img src="${escapeHtml(productImageUrl(image.storage_path))}" alt="" onerror="this.hidden=true">
            </button>
          `).join("")}
        </div>
      </div>
      <div class="detail-copy">
        ${soldByHtml(product)}
        <h1>${escapeHtml(product.title)}</h1>
        <p class="muted">${escapeHtml(t("productDetails"))}</p>
        ${priceHtml(product)}
        <p class="muted">${escapeHtml(ratingText)} ${escapeHtml(t("average"))} · ${escapeHtml(String(product.reviews_count ?? 0))} ${escapeHtml(t("reviews"))}</p>
        <p class="${inStock ? "stock-ok" : "warning"}">${inStock ? `${escapeHtml(t("inStock"))} (${stock})` : escapeHtml(t("outOfStock"))}</p>
        <h2>${escapeHtml(t("description"))}</h2>
        <p class="description">${product.description ? escapeHtml(product.description) : escapeHtml(t("noDescription"))}</p>
        <div class="qty">
          <button type="button" data-step="-1" aria-label="${escapeHtml(t("decrease"))}" ${inStock ? "" : "disabled"}>−</button>
          <label class="sr-only" for="qty">${escapeHtml(t("quantity"))}</label>
          <input id="qty" type="number" min="1" max="${stock}" value="1" ${inStock ? "" : "disabled"}>
          <button type="button" data-step="1" aria-label="${escapeHtml(t("increase"))}" ${inStock ? "" : "disabled"}>+</button>
        </div>
        <div class="card-actions">
          <button class="button button-primary" type="button" id="buy-now" ${inStock ? "" : "disabled"}>${escapeHtml(t("buyNow"))}</button>
          <button class="button button-ghost" type="button" id="add-cart" ${inStock ? "" : "disabled"}>${escapeHtml(t("addToCart"))}</button>
          <a class="button button-ghost" id="message-shop" href="${url("pages/chat.html")}?shop=${encodeURIComponent(product.vendor_id)}&product=${encodeURIComponent(product.id)}">${escapeHtml(t("messageShop"))}</a>
          <button class="icon-button ${saved ? "is-saved" : ""}" type="button" id="save-wish" aria-pressed="${saved ? "true" : "false"}" aria-label="${escapeHtml(t("save"))} ${escapeHtml(product.title)}">
            ${escapeHtml(t("save"))}
          </button>
        </div>
      </div>
    </div>
  `;
  root.setAttribute("aria-busy", "false");

  const qty = root.querySelector("#qty");
  root.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!(qty instanceof HTMLInputElement)) return;
      const step = Number(button.getAttribute("data-step"));
      const next = clampQty(Number(qty.value) + step, stock);
      qty.value = String(next);
    });
  });

  root.querySelector("#add-cart")?.addEventListener("click", async () => {
    const button = root.querySelector("#add-cart");
    if (!(button instanceof HTMLButtonElement) || !(qty instanceof HTMLInputElement)) return;
    button.disabled = true;
    try {
      const result = await addToCart(product.id, clampQty(Number(qty.value), stock));
      toast(result.capped ? `Only ${result.stock} in stock. Added that many.` : "Added to cart.", result.capped ? "info" : "success");
    } catch (error) {
      console.error("Add to cart:", error);
      toast(authErrorMessage(error), "error");
    } finally {
      button.disabled = false;
    }
  });

  root.querySelector("#buy-now")?.addEventListener("click", async () => {
    const button = root.querySelector("#buy-now");
    if (!(button instanceof HTMLButtonElement) || !(qty instanceof HTMLInputElement)) return;
    const profile = await getCurrentProfile();
    if (!profile) {
      window.location.assign(loginRedirect());
      return;
    }
    button.disabled = true;
    try {
      setBuyNow(product.id, clampQty(Number(qty.value), stock));
      window.location.assign(url("pages/checkout.html"));
    } catch (error) {
      console.error("Buy now:", error);
      toast(authErrorMessage(error), "error");
      button.disabled = false;
    }
  });

  root.querySelector("#save-wish")?.addEventListener("click", async () => {
    const button = root.querySelector("#save-wish");
    if (!(button instanceof HTMLButtonElement)) return;
    const profile = await getCurrentProfile();
    if (!profile) {
      window.location.assign(loginRedirect());
      return;
    }
    button.disabled = true;
    const wasSaved = button.getAttribute("aria-pressed") === "true";
    try {
      if (wasSaved) await removeWishlist(product.id);
      else await addWishlist(product.id);
      button.classList.toggle("is-saved", !wasSaved);
      button.setAttribute("aria-pressed", wasSaved ? "false" : "true");
      toast(wasSaved ? "Removed from wishlist." : "Saved to wishlist.", "success");
    } catch (error) {
      toast(authErrorMessage(error), "error");
    } finally {
      button.disabled = false;
    }
  });

  root.querySelectorAll("#gallery-thumbs button").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-index"));
      const main = root.querySelector("#gallery-main");
      if (main) main.innerHTML = galleryMain([images[index]], product.title);
      root.querySelectorAll("#gallery-thumbs button").forEach((thumb) => {
        thumb.classList.toggle("is-active", thumb === button);
      });
    });
  });
}

/**
 * Seller card: logo, name, product count when known, Visit store.
 * Schema has no shop rating or verified flag.
 * @param {object} product
 */
async function renderSeller(product) {
  if (!sellerRoot) return;
  const shop = shopOf(product);
  if (!shop) {
    sellerRoot.innerHTML = "";
    return;
  }

  let productCount = null;
  try {
    const full = await getShop({ slug: shop.slug, id: shop.profile_id });
    if (full) productCount = full.productCount;
  } catch {
    productCount = null;
  }

  const countLine = productCount != null
    ? `<p class="muted">${escapeHtml(String(productCount))} products</p>`
    : `<p class="muted">Independent seller on EME</p>`;

  const profile = await getCurrentProfile().catch(() => null);
  let following = false;
  if (profile && profile.id !== shop.profile_id) {
    try {
      following = (await followedShopIds([shop.profile_id])).has(shop.profile_id);
    } catch (error) {
      console.error("product follow:", error);
    }
  }
  const ownShop = profile?.id === shop.profile_id;

  sellerRoot.innerHTML = `
    <div class="seller-card">
      <div class="seller-card-row">
        ${shopLogoHtml(shop, "shop-logo-md")}
        <div>
          <h2>${escapeHtml(shop.shop_name)}</h2>
          ${countLine}
        </div>
      </div>
      <div class="storefront-actions">
        <a class="button button-primary" href="${shopHref(shop.slug)}">Visit store</a>
        ${ownShop ? "" : `<button class="button button-ghost" type="button" data-follow-shop aria-pressed="${following ? "true" : "false"}">${following ? "Following" : "Follow"}</button>`}
        <a class="button button-ghost" href="${url("pages/chat.html")}?shop=${encodeURIComponent(shop.profile_id)}&product=${encodeURIComponent(product.id)}">Message</a>
      </div>
    </div>
  `;

  sellerRoot.querySelector("[data-follow-shop]")?.addEventListener("click", async () => {
    const signedIn = await getCurrentProfile();
    if (!signedIn) {
      window.location.assign(loginRedirect());
      return;
    }
    const button = sellerRoot.querySelector("[data-follow-shop]");
    if (!(button instanceof HTMLButtonElement)) return;
    const on = button.getAttribute("aria-pressed") === "true";
    button.disabled = true;
    try {
      if (on) await unfollowShop(shop.profile_id);
      else await followShop(shop.profile_id);
      button.setAttribute("aria-pressed", on ? "false" : "true");
      button.textContent = on ? "Follow" : "Following";
    } catch (error) {
      console.error("toggle follow:", error);
      toast(authErrorMessage(error), "error");
    } finally {
      button.disabled = false;
    }
  });
}

/**
 * @param {object} product
 */
async function renderMoreFromStore(product) {
  if (!moreRoot) return;
  const shop = shopOf(product);
  if (!shop?.profile_id && !product.vendor_id) {
    moreRoot.innerHTML = "";
    return;
  }

  try {
    const vendorId = product.vendor_id || shop.profile_id;
    const rows = await productsFromShop(vendorId, product.id);
    let saved = new Set();
    try {
      const profile = await getCurrentProfile();
      if (profile) saved = await wishlistIds();
    } catch {
      saved = new Set();
    }

    moreRoot.innerHTML = `
      <div class="section-head">
        <h2>More from this store</h2>
        ${shop?.slug ? `<a href="${shopHref(shop.slug)}">View store</a>` : ""}
      </div>
      ${rows.length
        ? `<div class="product-grid">${rows.map((row) => productCardHtml(row, { saved: saved.has(row.id) })).join("")}</div>`
        : `<p class="empty">No other products from this store yet.</p>`}
    `;
  } catch (error) {
    toast(authErrorMessage(error), "error");
    moreRoot.innerHTML = `<p class="empty">More from this store could not be loaded.</p>`;
  }
}

/**
 * @param {object} product
 */
async function renderReviews(product) {
  if (!reviewRoot) return;
  try {
    const profile = await getCurrentProfile();
    const [reviews, allowed] = await Promise.all([
      listReviews(product.id),
      profile ? canReviewProduct(product.id).catch((error) => {
        console.error("Review eligibility:", error);
        return false;
      }) : Promise.resolve(false),
    ]);
    const mine = profile ? reviews.find((review) => review.customerId === profile.id) : null;
    const items = reviews.length
      ? reviews.map((review) => `
          <article class="review">
            <div class="review-head">
              <strong>${escapeHtml(review.author)}</strong>
              <span class="badge">${escapeHtml(String(review.rating))} / 5</span>
            </div>
            <p>${review.comment ? escapeHtml(review.comment) : "No written comment."}</p>
            <time datetime="${escapeHtml(review.created_at)}">${escapeHtml(formatDate(review.created_at))}</time>
          </article>
        `).join("")
      : `<p class="empty">No reviews yet.</p>`;

    reviewRoot.innerHTML = `
      <div class="section-head">
        <h2>Reviews</h2>
      </div>
      ${reviewFormHtml(profile, allowed, mine)}
      <div class="review-list">${items}</div>
    `;
    reviewRoot.querySelector("#review-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const data = new FormData(form);
      const button = form.querySelector("button[type='submit']");
      if (button instanceof HTMLButtonElement) button.disabled = true;
      try {
        await saveReview({
          productId: product.id,
          reviewId: mine?.id,
          rating: Number(data.get("rating")),
          comment: String(data.get("comment") || ""),
        });
        toast(mine ? "Review updated." : "Review posted.", "success");
        await renderReviews(product);
      } catch (error) {
        console.error("Save review:", error);
        toast(authErrorMessage(error), "error");
        if (button instanceof HTMLButtonElement) button.disabled = false;
      }
    });
  } catch (error) {
    console.error("Reviews:", error);
    toast(authErrorMessage(error), "error");
    reviewRoot.innerHTML = `<p class="empty">Reviews could not be loaded.</p>`;
  }
}

/**
 * @param {import("./auth.js?v=3").Profile | null} profile
 * @param {boolean} allowed
 * @param {{ id: string, rating: number, comment: string | null } | undefined} mine
 * @returns {string}
 */
function reviewFormHtml(profile, allowed, mine) {
  if (!profile) {
    return `<p class="muted"><a href="${loginRedirect()}">Sign in</a> to review a product you have received.</p>`;
  }
  if (!allowed && !mine) {
    return `<p class="muted">You can write a review after this product is delivered.</p>`;
  }
  const rating = mine?.rating || 5;
  return `
    <form id="review-form" class="account-card">
      <h3>${mine ? "Your review" : "Write a review"}</h3>
      <fieldset class="review-stars">
        <legend>Rating</legend>
        ${[1, 2, 3, 4, 5].map((value) => `
          <label>
            <input type="radio" name="rating" value="${value}" ${value === rating ? "checked" : ""} required>
            ${value}
          </label>
        `).join("")}
      </fieldset>
      <label class="field">
        <span>Comment (optional)</span>
        <textarea name="comment" rows="3" maxlength="2000">${escapeHtml(mine?.comment || "")}</textarea>
      </label>
      <button class="button button-primary" type="submit">${mine ? "Update review" : "Post review"}</button>
    </form>
  `;
}

/**
 * @param {object} product
 */
async function renderRelated(product) {
  if (!relatedRoot) return;
  try {
    const rows = await relatedProducts(product.category_id, product.id);
    let saved = new Set();
    try {
      const profile = await getCurrentProfile();
      if (profile) saved = await wishlistIds();
    } catch {
      saved = new Set();
    }
    relatedRoot.innerHTML = `
      <div class="section-head"><h2>Related products</h2></div>
      ${rows.length
        ? `<div class="product-grid">${rows.map((row) => productCardHtml(row, { saved: saved.has(row.id) })).join("")}</div>`
        : `<p class="empty">No other products in this category.</p>`}
    `;
  } catch (error) {
    toast(authErrorMessage(error), "error");
    relatedRoot.innerHTML = `<p class="empty">Related products could not be loaded.</p>`;
  }
}

/**
 * @param {Array<{ storage_path: string, sort_order: number, is_primary: boolean }> | null} images
 * @returns {Array<{ storage_path: string, sort_order: number, is_primary: boolean }>}
 */
function sortImages(images) {
  return [...(images || [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}

/**
 * @param {Array<{ storage_path: string }> } images
 * @param {string} title
 * @returns {string}
 */
function galleryMain(images, title) {
  const image = images[0] ? pickProductImage(images) || images[0] : null;
  if (!image?.storage_path) return `<span class="product-fallback">${escapeHtml(title.slice(0, 1))}</span>`;
  return `
    <img src="${escapeHtml(productImageUrl(image.storage_path))}" alt="${escapeHtml(title)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
    <span class="product-fallback" hidden>${escapeHtml(title.slice(0, 1))}</span>
  `;
}

/**
 * @param {number} value
 * @param {number} stock
 * @returns {number}
 */
function clampQty(value, stock) {
  const next = Math.floor(Number(value));
  if (!Number.isFinite(next) || next < 1) return 1;
  return Math.min(next, Math.max(stock, 1));
}

/**
 * @param {string} value
 * @returns {string}
 */
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
