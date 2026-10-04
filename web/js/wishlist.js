import { mountAccountNav } from "./accountShell.js";
import { moveWishlistToCart, listWishlist, removeWishlist } from "./api/wishlistApi.js";
import { authErrorMessage, requireUser } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js";
import { escapeHtml } from "./html.js";
import { imageHtml, priceHtml, productHref } from "./productView.js";
import { soldByHtml } from "./shopView.js";
import { url } from "./paths.js";
import { showState } from "./ui-state.js";

const root = document.querySelector("#wishlist-root");

start();

async function start() {
  try {
    const profile = await requireUser();
    if (!profile) return;
    mountShell({ page: "wishlist" });
    mountAccountNav("wishlist");
    await load();
  } catch (error) {
    mountShell({ page: "wishlist" });
    mountAccountNav("wishlist");
    const message = authErrorMessage(error);
    toast(message, "error");
    if (root) showState(root, escapeHtml(message), () => load());
  }
}

async function load() {
  if (!root) return;
  try {
    const rows = await listWishlist();
    if (!rows.length) {
      root.innerHTML = `<p class="empty">No saved products yet. <a href="${url("pages/products.html")}">Browse products</a></p>`;
      return;
    }

    root.innerHTML = `
      <div class="product-grid">
        ${rows.map((row) => card(row)).join("")}
      </div>
    `;

    root.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => update(button.getAttribute("data-remove"), "remove"));
    });
    root.querySelectorAll("[data-move]").forEach((button) => {
      button.addEventListener("click", () => update(button.getAttribute("data-move"), "move"));
    });
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    root.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
  } finally {
    root.setAttribute("aria-busy", "false");
  }
}

/**
 * @param {{ productId: string, product: object | null }} row
 * @returns {string}
 */
function card(row) {
  const product = row.product;
  if (!product || product.status !== "active") {
    return `
      <article class="product-card">
        <div class="product-copy">
          <h3>Unavailable product</h3>
          <p class="warning">This product is no longer available.</p>
          <button class="button button-ghost" type="button" data-remove="${escapeHtml(row.productId)}">Remove</button>
        </div>
      </article>
    `;
  }

  const shop = product.vendor_profiles;
  const shopStatus = Array.isArray(shop) ? shop[0]?.status : shop?.status;
  const hidden = shopStatus && shopStatus !== "approved";

  return `
    <article class="product-card">
      <a class="product-media" href="${productHref(product)}">${imageHtml(product)}</a>
      <div class="product-copy">
        ${soldByHtml(product)}
        <h3><a href="${productHref(product)}">${escapeHtml(product.title)}</a></h3>
        ${priceHtml(product)}
        ${hidden ? `<p class="warning">This shop is not approved right now.</p>` : ""}
        <div class="card-actions">
          <button class="button button-primary" type="button" data-move="${escapeHtml(row.productId)}">Move to cart</button>
          <button class="button button-ghost" type="button" data-remove="${escapeHtml(row.productId)}">Remove</button>
        </div>
      </div>
    </article>
  `;
}

/**
 * @param {string | null} productId
 * @param {"remove" | "move"} action
 */
async function update(productId, action) {
  if (!productId) return;
  try {
    if (action === "move") {
      const result = await moveWishlistToCart(productId);
      toast(result.capped ? `Only ${result.stock} in stock. Added that many.` : "Moved to cart.", result.capped ? "info" : "success");
    } else {
      await removeWishlist(productId);
      toast("Removed from wishlist.", "success");
    }
    await load();
  } catch (error) {
    toast(authErrorMessage(error), "error");
  }
}
