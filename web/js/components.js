import {
  authErrorMessage,
  getCurrentProfile,
  onAuthStateChange,
  signOut,
} from "./auth.js";
import { fetchBadgeCounts } from "./catalog.js";
import { escapeHtml } from "./html.js";
import { icon } from "./icons.js";
import { url } from "./paths.js";

/** @type {number} */
let toastId = 0;

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
 * Injects the header, footer, and mobile navigation, then keeps them in sync with auth.
 * @param {{ page?: string }} [options]
 */
export function mountShell(options = {}) {
  const page = options.page || "";
  renderChrome(null, { cart: 0, wishlist: 0 }, page);
  refreshShell(page);
  onAuthStateChange(() => refreshShell(page));
  document.addEventListener("click", (event) => {
    const header = document.querySelector("#site-header");
    if (!(event.target instanceof Node) || !header?.contains(event.target)) {
      header?.querySelector(".account-menu")?.classList.remove("is-open");
    }
  });
}

/**
 * @param {string} page
 */
async function refreshShell(page) {
  let profile = null;
  let counts = { cart: 0, wishlist: 0 };

  try {
    profile = await getCurrentProfile();
    counts = await fetchBadgeCounts(profile?.id ?? null);
  } catch (error) {
    if (page !== "home") toast(authErrorMessage(error), "error");
  }

  renderChrome(profile, counts, page);
}

/**
 * @param {import("./auth.js").Profile | null} profile
 * @param {{ cart: number, wishlist: number }} counts
 * @param {string} page
 */
function renderChrome(profile, counts, page) {
  const header = document.querySelector("#site-header");
  const footer = document.querySelector("#site-footer");
  const bottom = document.querySelector("#bottom-nav");
  if (!header || !footer || !bottom) return;

  const home = url("index.html");
  const login = url("pages/login.html");
  const register = url("pages/register.html");
  const query = new URLSearchParams(window.location.search).get("q") || "";
  const name = profile?.full_name?.trim() || "Account";
  const roleLabel = profile ? roleName(profile.role) : "";

  header.innerHTML = `
    <div class="header-inner">
      <div class="header-top">
        <a class="logo" href="${home}">EME</a>
        <div class="header-actions">
          <button class="icon-button" type="button" data-soon="wishlist" aria-label="Wishlist, ${counts.wishlist} items">
            ${icon("heart")}
            <span class="count-badge">${counts.wishlist}</span>
          </button>
          <button class="icon-button" type="button" data-soon="cart" aria-label="Cart, ${counts.cart} items">
            ${icon("cart")}
            <span class="count-badge">${counts.cart}</span>
          </button>
          ${profile ? accountMenu(name, roleLabel) : guestLinks(login, register)}
        </div>
      </div>
      <form class="search-form" action="${home}" method="get" role="search">
        <label class="sr-only" for="site-search">Search products</label>
        <input id="site-search" name="q" type="search" placeholder="Search products" value="${escapeHtml(query)}" autocomplete="off">
        <button class="button button-primary" type="submit">${icon("search")}<span>Search</span></button>
      </form>
    </div>
  `;

  footer.innerHTML = `
    <div class="footer-inner">
      <p class="logo">EME</p>
      <p>Multi-vendor shop for products, reels, and live selling. Prices are in BDT.</p>
    </div>
  `;

  bottom.innerHTML = `
    <a class="${page === "home" ? "is-active" : ""}" href="${home}">${icon("home")}<span>Home</span></a>
    <button type="button" data-soon="cart">${icon("cart")}<span>Cart</span><span class="count-badge">${counts.cart}</span></button>
    <button type="button" data-soon="wishlist">${icon("heart")}<span>Saved</span><span class="count-badge">${counts.wishlist}</span></button>
    <a class="${page === "login" || page === "register" ? "is-active" : ""}" href="${profile ? home : login}">
      ${icon("user")}<span>${profile ? "You" : "Login"}</span>
    </a>
  `;

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

  document.querySelectorAll("[data-soon]").forEach((node) => {
    node.addEventListener("click", () => {
      const which = node.getAttribute("data-soon") === "cart" ? "Cart" : "Wishlist";
      toast(`${which} opens in the next step.`, "info");
    });
  });
}

/**
 * @param {string} name
 * @param {string} roleLabel
 * @returns {string}
 */
function accountMenu(name, roleLabel) {
  return `
    <div class="account">
      <button class="button button-ghost" type="button" data-account-toggle aria-expanded="false">
        ${icon("user")}
        <span class="account-name">${escapeHtml(name)}</span>
      </button>
      <div class="account-menu">
        <p>${escapeHtml(name)}</p>
        <span class="badge">${escapeHtml(roleLabel)}</span>
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
      <button class="icon-button" type="button" data-account-toggle aria-expanded="false" aria-label="Account menu">
        ${icon("user")}
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
