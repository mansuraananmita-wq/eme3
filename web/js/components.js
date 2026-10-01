import {
  authErrorMessage,
  getCurrentProfile,
  onAuthStateChange,
  signOut,
} from "./auth.js";
import { cartCount, mergeGuestCart } from "./api/cartApi.js";
import { listCategories } from "./api/categoriesApi.js";
import { wishlistCount } from "./api/wishlistApi.js";
import { ANNOUNCEMENTS } from "./data/banners.js";
import { isSupabaseConfigured } from "./supabaseClient.js";
import { escapeHtml } from "./html.js";
import { icon } from "./icons.js";
import { url } from "./paths.js";
import { syncConfigBanner } from "./ui-state.js";

/** @type {number} */
let toastId = 0;

/** @type {Array<{ id: string, parent_id: string | null, name: string, slug: string, image_url: string | null }> | null} */
let categoryCache = null;

const ANNOUNCE_KEY = "eme_announce_closed";

/**
 * Shows a short message. type is "info", "success", or "error".
 * @param {string} message
 * @param {"info" | "success" | "error"} [type]
 */
export function toast(message, type = "info") {
  const root = document.querySelector("#toast-root");
  if (!root) return;

  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.role = type === "error" ? "alert" : "status";
  item.textContent = message;
  root.append(item);

  const current = ++toastId;
  window.setTimeout(() => {
    if (toastId >= current) item.remove();
  }, 4200);
}

/**
 * @param {{ title: string, body: string, confirmLabel?: string, onConfirm?: () => void | Promise<void> }} options
 */
export function openModal({ title, body, confirmLabel = "OK", onConfirm }) {
  const root = document.querySelector("#modal-root");
  if (!root) return;

  root.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head">
          <h2 id="modal-title">${escapeHtml(title)}</h2>
          <button class="icon-button" type="button" data-close-modal aria-label="Close">
            ${icon("close")}
          </button>
        </div>
        <p class="modal-body">${escapeHtml(body)}</p>
        <div class="modal-actions">
          <button class="button button-ghost" type="button" data-close-modal>Cancel</button>
          <button class="button button-primary" type="button" data-modal-confirm>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    root.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  };

  const onKey = (event) => {
    if (event.key === "Escape") close();
  };

  document.addEventListener("keydown", onKey);
  root.querySelector("[data-modal-confirm]")?.addEventListener("click", async () => {
    try {
      await onConfirm?.();
      close();
    } catch (error) {
      toast(authErrorMessage(error), "error");
    }
  });
  root.querySelectorAll("button[data-close-modal]").forEach((node) => {
    node.addEventListener("click", close);
  });
  root.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  root.querySelector("[data-modal-confirm]")?.focus();
}

/**
 * Injects the marketplace chrome and keeps counts in sync.
 * @param {{ page?: string }} [options]
 */
export function mountShell(options = {}) {
  const page = options.page || "";
  syncConfigBanner(isSupabaseConfigured());
  renderChrome(null, { cart: 0, wishlist: 0 }, page, []);
  refreshShell(page);
  onAuthStateChange(() => refreshShell(page));
  window.addEventListener("eme-counts", () => refreshShell(page));
  document.addEventListener("click", (event) => {
    const header = document.querySelector("#site-header");
    if (!(event.target instanceof Node) || !header?.contains(event.target)) {
      header?.querySelector(".account-menu")?.classList.remove("is-open");
      header?.querySelector(".mega-wrap")?.classList.remove("is-open");
    }
  });
}

/**
 * @param {string} page
 */
async function refreshShell(page) {
  let profile = null;
  let counts = { cart: 0, wishlist: 0 };
  let categories = categoryCache || [];

  try {
    syncConfigBanner(isSupabaseConfigured());
    if (isSupabaseConfigured()) {
      if (!categoryCache) categoryCache = await listCategories();
      categories = categoryCache;
      profile = await getCurrentProfile();
      if (profile) await mergeGuestCart(profile.id);
      counts = {
        cart: await cartCount(profile?.id ?? null),
        wishlist: await wishlistCount(profile?.id ?? null),
      };
    }
  } catch (error) {
    const message = authErrorMessage(error);
    if (!message.toLowerCase().includes("config.js")) toast(message, "error");
  }

  renderChrome(profile, counts, page, categories);
}

/**
 * @param {import("./auth.js").Profile | null} profile
 * @param {{ cart: number, wishlist: number }} counts
 * @param {string} page
 * @param {Array<{ id: string, parent_id: string | null, name: string, slug: string, image_url: string | null }>} categories
 */
function renderChrome(profile, counts, page, categories) {
  const header = document.querySelector("#site-header");
  const footer = document.querySelector("#site-footer");
  const bottom = document.querySelector("#bottom-nav");
  if (!header || !footer || !bottom) return;

  const home = url("index.html");
  const login = url("pages/login.html");
  const register = url("pages/register.html");
  const products = url("pages/products.html");
  const categoriesPage = url("pages/categories.html");
  const shops = url("pages/shops.html");
  const sell = url("pages/sell.html");
  const reels = url("pages/reels.html");
  const lives = url("pages/lives.html");
  const cart = url("pages/cart.html");
  const wishlist = url("pages/wishlist.html");
  const orders = url("pages/account/orders.html");
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || "";
  const category = params.get("category") || "";
  const name = profile?.full_name?.trim() || "Account";
  const roleLabel = profile ? roleName(profile.role) : "";
  const roots = categories.filter((row) => !row.parent_id);
  const announceHidden = isAnnounceClosed();

  header.innerHTML = `
    <div class="announce-bar${announceHidden ? " is-hidden" : ""}" data-announce>
      <div class="announce-bar-inner">
        <button class="announce-close" type="button" data-announce-close aria-label="Close announcement">×</button>
        <p class="announce-msg" data-announce-msg>${escapeHtml(ANNOUNCEMENTS[0] || "")}</p>
        <div class="announce-links">
          <a href="${orders}">Track order</a>
          <a href="${sell}">Sell on EME</a>
          <button type="button" data-help>Help</button>
          <div class="lang-toggle" role="group" aria-label="Language">
            <button type="button" data-lang="bn">BN</button>
            <button type="button" class="is-active" data-lang="en">EN</button>
          </div>
        </div>
      </div>
    </div>
    <div class="header-main">
      <a class="logo" href="${home}">EME</a>
      <form class="search-form" action="${products}" method="get" role="search">
        <label class="sr-only" for="search-category">Category</label>
        <select id="search-category" name="category">
          <option value="">All</option>
          ${roots.map((row) => `
            <option value="${escapeHtml(row.slug)}" ${row.slug === category ? "selected" : ""}>
              ${escapeHtml(row.name)}
            </option>
          `).join("")}
        </select>
        <label class="sr-only" for="site-search">Search products</label>
        <input id="site-search" name="q" type="search" placeholder="Search in EME" value="${escapeHtml(query)}" autocomplete="off">
        <button class="button button-primary" type="submit" aria-label="Search">${icon("search")}</button>
      </form>
      <div class="header-actions">
        ${profile
          ? accountMenu(name, roleLabel, cart, wishlist)
          : guestLinks(login, register)}
        <a class="header-link" href="${wishlist}" aria-label="Wishlist, ${counts.wishlist} items">
          ${icon("heart")}
          <span class="action-label">Wishlist</span>
          <span class="count-badge">${counts.wishlist}</span>
        </a>
        <a class="header-link" href="${cart}" aria-label="Cart, ${counts.cart} items">
          ${icon("cart")}
          <span class="action-label">Cart</span>
          <span class="count-badge">${counts.cart}</span>
        </a>
      </div>
    </div>
    <nav class="cat-nav" aria-label="Categories">
      <div class="cat-nav-inner">
        <div class="mega-wrap">
          <button class="mega-trigger" type="button" data-mega-toggle aria-expanded="false" aria-haspopup="true">
            ${icon("grid")} All categories
          </button>
          <div class="mega-panel" hidden data-mega-panel>
            ${megaMenuHtml(categories, products, categoriesPage)}
          </div>
        </div>
        <a class="cat-nav-link" href="${shops}">Stores</a>
        <a class="cat-nav-link ${page === "reels" ? "is-active" : ""}" href="${reels}">Reels</a>
        <a class="cat-nav-link ${page === "lives" ? "is-active" : ""}" href="${lives}">Live</a>
        <a class="cat-nav-link ${page === "sell" ? "is-active" : ""}" href="${sell}">Sell on EME</a>
        ${roots.slice(0, 8).map((row) => `
          <a class="cat-nav-link desktop-only ${row.slug === category ? "is-active" : ""}" href="${products}?category=${encodeURIComponent(row.slug)}">
            ${escapeHtml(row.name)}
          </a>
        `).join("")}
      </div>
      <div class="cat-round-strip" aria-label="Browse categories">
        ${roots.slice(0, 12).map((row) => categoryRoundHtml(row, products)).join("")}
      </div>
    </nav>
  `;

  footer.innerHTML = `
    <div class="footer-grid">
      <div class="footer-col">
        <h3>About</h3>
        <p>EME is a multi-vendor marketplace for everyday shopping in Bangladesh.</p>
        <a href="${home}">Home</a>
        <a href="${shops}">Browse stores</a>
      </div>
      <div class="footer-col">
        <h3>Customer service</h3>
        <a href="${orders}">Track order</a>
        <a href="${cart}">Your cart</a>
        <a href="${wishlist}">Wishlist</a>
        <a href="${products}">Browse products</a>
      </div>
      <div class="footer-col">
        <h3>Sell on EME</h3>
        <p>Open a shop and reach customers with products, reels, and live selling.</p>
        <a href="${sell}">Seller landing</a>
        <a href="${sell}#sell-apply">Apply to sell</a>
        <a href="${register}">Create account</a>
      </div>
      <div class="footer-col">
        <h3>Contact</h3>
        <p>support@eme.test</p>
        <p>Dhaka, Bangladesh</p>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="trust-badges">
        <span>bKash</span>
        <span>Nagad</span>
        <span>Card</span>
        <span>Cash on delivery</span>
      </div>
      <p>© ${new Date().getFullYear()} EME. All rights reserved.</p>
    </div>
  `;

  bottom.innerHTML = `
    <a class="${page === "home" ? "is-active" : ""}" href="${home}">${icon("home")}<span>Home</span></a>
    <a class="${page === "reels" ? "is-active" : ""}" href="${reels}">${icon("reels")}<span>Reels</span></a>
    <a class="${page === "lives" ? "is-active" : ""}" href="${lives}">${icon("live")}<span>Live</span></a>
    <a class="${page === "cart" || page === "checkout" ? "is-active" : ""}" href="${cart}">${icon("cart")}<span>Cart</span><span class="count-badge">${counts.cart}</span></a>
    <a class="${page === "login" || page === "register" || page === "wishlist" || page === "sell" || page === "account" || page === "categories" || page === "products" ? "is-active" : ""}" href="${profile ? url("pages/account/profile.html") : login}">
      ${icon("user")}<span>Account</span>
    </a>
  `;

  bindHeaderInteractions(header, home);
}

/**
 * @param {HTMLElement} header
 * @param {string} home
 */
function bindHeaderInteractions(header, home) {
  let announceIndex = 0;
  const msg = header.querySelector("[data-announce-msg]");
  if (msg && ANNOUNCEMENTS.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(() => {
      announceIndex = (announceIndex + 1) % ANNOUNCEMENTS.length;
      msg.textContent = ANNOUNCEMENTS[announceIndex];
    }, 4500);
  }

  header.querySelector("[data-announce-close]")?.addEventListener("click", () => {
    header.querySelector("[data-announce]")?.classList.add("is-hidden");
    try {
      localStorage.setItem(ANNOUNCE_KEY, "1");
    } catch {
      /* ignore */
    }
  });

  header.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      header.querySelectorAll("[data-lang]").forEach((node) => node.classList.remove("is-active"));
      button.classList.add("is-active");
      toast("Language switching comes in a later step.", "info");
    });
  });

  header.querySelector("[data-help]")?.addEventListener("click", () => {
    toast("Email support@eme.test — help center comes later.", "info");
  });

  const megaWrap = header.querySelector(".mega-wrap");
  const megaPanel = header.querySelector("[data-mega-panel]");
  const megaToggle = header.querySelector("[data-mega-toggle]");

  const openMega = (open) => {
    megaWrap?.classList.toggle("is-open", open);
    megaToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    if (megaPanel instanceof HTMLElement) megaPanel.hidden = !open;
  };

  megaToggle?.addEventListener("click", () => {
    openMega(!megaWrap?.classList.contains("is-open"));
  });

  megaWrap?.addEventListener("mouseenter", () => {
    if (window.matchMedia("(hover: hover) and (min-width: 900px)").matches) openMega(true);
  });
  megaWrap?.addEventListener("mouseleave", () => {
    if (window.matchMedia("(hover: hover) and (min-width: 900px)").matches) openMega(false);
  });

  header.querySelector("[data-account-toggle]")?.addEventListener("click", (event) => {
    const menu = header.querySelector(".account-menu");
    const open = menu?.classList.toggle("is-open");
    event.currentTarget.setAttribute("aria-expanded", open ? "true" : "false");
  });

  header.querySelector("[data-sign-out]")?.addEventListener("click", () => {
    openModal({
      title: "Sign out",
      body: "You will need to sign in again to see your cart and wishlist.",
      confirmLabel: "Sign out",
      onConfirm: async () => {
        await signOut();
        toast("Signed out.", "success");
        window.location.assign(home);
      },
    });
  });
}

/**
 * @returns {boolean}
 */
function isAnnounceClosed() {
  try {
    return localStorage.getItem(ANNOUNCE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * @param {Array<{ id: string, parent_id: string | null, name: string, slug: string }>} categories
 * @param {string} products
 * @param {string} categoriesPage
 * @returns {string}
 */
function megaMenuHtml(categories, products, categoriesPage) {
  const roots = categories.filter((row) => !row.parent_id).slice(0, 10);
  if (!roots.length) {
    return `<p class="muted">No categories yet. <a href="${categoriesPage}">Browse</a></p>`;
  }

  return `
    <div class="mega-grid">
      ${roots.map((root) => {
        const children = categories.filter((row) => row.parent_id === root.id).slice(0, 8);
        return `
          <div class="mega-col">
            <a class="mega-parent" href="${products}?category=${encodeURIComponent(root.slug)}">${escapeHtml(root.name)}</a>
            ${children.length
              ? `<ul>${children.map((child) => `
                  <li><a href="${products}?category=${encodeURIComponent(child.slug)}">${escapeHtml(child.name)}</a></li>
                `).join("")}</ul>`
              : ""}
          </div>
        `;
      }).join("")}
    </div>
    <a class="mega-all" href="${categoriesPage}">See all categories</a>
  `;
}

/**
 * @param {{ name: string, slug: string, image_url: string | null }} category
 * @param {string} products
 * @returns {string}
 */
function categoryRoundHtml(category, products) {
  const mark = category.image_url
    ? `<img src="${escapeHtml(category.image_url)}" alt="" loading="lazy" onerror="this.remove()">`
    : `<span>${escapeHtml(category.name.slice(0, 1))}</span>`;
  return `
    <a class="cat-round" href="${products}?category=${encodeURIComponent(category.slug)}">
      <span class="cat-round-icon">${mark}</span>
      <span class="cat-round-label">${escapeHtml(category.name)}</span>
    </a>
  `;
}

/**
 * @param {string} name
 * @param {string} roleLabel
 * @param {string} cart
 * @param {string} wishlist
 * @returns {string}
 */
function accountMenu(name, roleLabel, cart, wishlist) {
  const profile = url("pages/account/profile.html");
  const addresses = url("pages/account/addresses.html");
  const orders = url("pages/account/orders.html");
  const vendorOrders = url("pages/vendor-orders.html");
  const vendorReels = url("pages/vendor-reels.html");
  const isVendor = roleLabel === "Vendor";
  return `
    <div class="account">
      <button class="header-link" type="button" data-account-toggle aria-expanded="false" aria-label="Account menu">
        ${icon("user")}
        <span class="action-label">${escapeHtml(name.split(" ")[0] || "Account")}</span>
      </button>
      <div class="account-menu">
        <p>${escapeHtml(name)}</p>
        <span class="badge">${escapeHtml(roleLabel)}</span>
        <a href="${profile}">Profile</a>
        <a href="${orders}">Orders</a>
        ${isVendor ? `<a href="${vendorOrders}">Shop orders</a>` : ""}
        ${isVendor ? `<a href="${vendorReels}">Your reels</a>` : ""}
        <a href="${addresses}">Addresses</a>
        <a href="${wishlist}">Wishlist</a>
        <a href="${cart}">Cart</a>
        <button class="button button-ghost" type="button" data-sign-out>Sign out</button>
      </div>
    </div>
  `;
}

/**
 * @param {string} login
 * @param {string} register
 * @returns {string}
 */
function guestLinks(login, register) {
  return `
    <div class="guest-links">
      <a class="button button-ghost" href="${login}">Login</a>
      <a class="button button-primary" href="${register}">Register</a>
    </div>
    <div class="account guest-menu">
      <button class="header-link" type="button" data-account-toggle aria-expanded="false" aria-label="Account menu">
        ${icon("user")}
        <span class="action-label">Account</span>
      </button>
      <div class="account-menu">
        <a href="${login}">Login</a>
        <a href="${register}">Create account</a>
      </div>
    </div>
  `;
}

/**
 * @param {string} role
 * @returns {string}
 */
function roleName(role) {
  if (role === "admin") return "Admin";
  if (role === "vendor") return "Vendor";
  return "Customer";
}
