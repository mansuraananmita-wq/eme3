import { listCategories } from "./api/categoriesApi.js";
import { authErrorMessage } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=8";
import { escapeHtml } from "./html.js";
import { url } from "./paths.js?v=4";

mountShell({ page: "categories" });

const root = document.querySelector("#category-list");
load();

async function load() {
  if (!root) return;
  try {
    const categories = await listCategories();
    if (!categories.length) {
      root.innerHTML = `<p class="empty">No active categories yet.</p>`;
      return;
    }

    const byParent = new Map();
    for (const category of categories) {
      const key = category.parent_id || "root";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(category);
    }

    const roots = byParent.get("root") || categories.filter((category) => !category.parent_id);
    root.innerHTML = roots.map((category) => branch(category, byParent, 0)).join("");
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    root.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
  } finally {
    root.setAttribute("aria-busy", "false");
  }
}

/**
 * @param {{ id: string, name: string, slug: string, image_url: string | null }} category
 * @param {Map<string, Array<object>>} byParent
 * @param {number} depth
 * @returns {string}
 */
function branch(category, byParent, depth) {
  const href = `${url("pages/products.html")}?category=${encodeURIComponent(category.slug)}`;
  const mark = category.image_url
    ? `<img src="${escapeHtml(category.image_url)}" alt="">`
    : `<span class="category-mark">${escapeHtml(category.name.slice(0, 1))}</span>`;
  const children = byParent.get(category.id) || [];
  const nested = children.length
    ? `<div class="category-children">${children.map((child) => branch(child, byParent, depth + 1)).join("")}</div>`
    : "";

  return `
    <div class="category-branch depth-${Math.min(depth, 3)}">
      <a class="category-link" href="${href}">
        ${mark}
        <span>${escapeHtml(category.name)}</span>
      </a>
      ${nested}
    </div>
  `;
}
