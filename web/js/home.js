import { mountShell, toast } from "./components.js";
import { authErrorMessage } from "./auth.js";
import { fetchActiveCategories, fetchActiveProducts } from "./catalog.js";
import { formatMoney } from "./format.js";
import { escapeHtml } from "./html.js";
import { pickProductImage, productImageUrl } from "./media.js";

const search = new URLSearchParams(window.location.search).get("q")?.trim() || "";

mountShell({ page: "home" });
loadHome();

async function loadHome() {
  const categoryRoot = document.querySelector("#category-row");
  const productRoot = document.querySelector("#product-grid");
  if (!categoryRoot || !productRoot) return;

  try {
    const [categories, products] = await Promise.all([
      fetchActiveCategories(),
      fetchActiveProducts(search),
    ]);
    renderCategories(categoryRoot, categories);
    renderProducts(productRoot, products);
    categoryRoot.setAttribute("aria-busy", "false");
    productRoot.setAttribute("aria-busy", "false");
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    categoryRoot.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
    productRoot.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
    categoryRoot.setAttribute("aria-busy", "false");
    productRoot.setAttribute("aria-busy", "false");
  }
}

/**
 * @param {HTMLElement} root
 * @param {Array<{ id: string, parent_id: string | null, name: string, image_url: string | null }>} categories
 */
function renderCategories(root, categories) {
  if (!categories.length) {
    root.innerHTML = `<p class="empty">No active categories yet.</p>`;
    return;
  }

  const roots = categories.filter((category) => !category.parent_id);
  const shown = roots.length ? roots : categories;

  root.innerHTML = shown
    .map((category) => {
      const image = category.image_url
        ? `<img src="${escapeHtml(category.image_url)}" alt="">`
        : `<span class="category-mark">${escapeHtml(category.name.slice(0, 1))}</span>`;
      return `
        <article class="category-card">
          ${image}
          <h3>${escapeHtml(category.name)}</h3>
        </article>
      `;
    })
    .join("");
}

/**
 * @param {HTMLElement} root
 * @param {Array<object>} products
 */
function renderProducts(root, products) {
  const heading = document.querySelector("#product-heading");
  if (heading) {
    heading.textContent = search ? `Results for “${search}”` : "New products";
  }

  if (!products.length) {
    root.innerHTML = `<p class="empty">${
      search
        ? "No active products match that search."
        : "No active products from approved shops yet."
    }</p>`;
    return;
  }

  root.innerHTML = products
    .map((product) => {
      const shop = shopOf(product);
      const image = pickProductImage(product.product_images);
      const src = image ? productImageUrl(image.storage_path) : "";
      const price = formatMoney(product.price, product.currency);
      const compare =
        product.compare_at_price != null && Number(product.compare_at_price) > Number(product.price)
          ? `<s>${escapeHtml(formatMoney(product.compare_at_price, product.currency))}</s>`
          : "";
      const media = src
        ? `<img src="${escapeHtml(src)}" alt="">`
        : `<span class="product-fallback">${escapeHtml(product.title.slice(0, 1))}</span>`;

      return `
        <article class="product-card">
          <div class="product-media">${media}</div>
          <div class="product-copy">
            <p class="shop-name">${escapeHtml(shop)}</p>
            <h3>${escapeHtml(product.title)}</h3>
            <p class="price">${escapeHtml(price)} ${compare}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

/**
 * @param {object} product
 * @returns {string}
 */
function shopOf(product) {
  const shop = product.vendor_profiles;
  if (Array.isArray(shop)) return shop[0]?.shop_name || "Shop";
  return shop?.shop_name || "Shop";
}
