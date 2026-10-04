import {
  adminPanelAccess,
  archiveProduct,
  listAllOrders,
  listModerationProducts,
  listModerationReels,
  listVendorApplications,
  removeReel,
  setVendorStatus,
} from "./api/adminApi.js";
import { authErrorMessage, getCurrentProfile } from "./auth.js";
import { mountShell, openModal, toast } from "./components.js";
import { formatMoney } from "./format.js";
import { escapeHtml } from "./html.js";
import { loginRedirect, url } from "./paths.js";
import { showState } from "./ui-state.js";

mountShell({ page: "account" });

const root = document.querySelector("#admin-root");
/** @type {"vendors" | "moderation" | "orders"} */
let tab = "vendors";

boot();

async function boot() {
  if (!(root instanceof HTMLElement)) return;

  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch (error) {
    console.error("Admin profile:", error);
    deny(authErrorMessage(error), url("index.html"));
    return;
  }

  if (!profile) {
    deny("Not allowed. Sign in with an admin account.", loginRedirect());
    return;
  }

  let allowed = false;
  try {
    allowed = profile.role === "admin" && (await adminPanelAccess());
  } catch (error) {
    console.error("Admin access:", error);
    deny(authErrorMessage(error), url("index.html"));
    return;
  }

  if (!allowed) {
    deny("Not allowed.", url("index.html"));
    return;
  }

  await render();
}

/**
 * @param {string} message
 * @param {string} next
 */
function deny(message, next) {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <div class="state-panel">
      <p>Not allowed</p>
      <p class="muted">${escapeHtml(message)}</p>
    </div>
  `;
  window.setTimeout(() => {
    window.location.assign(next);
  }, 1200);
}

async function render() {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "true");
  root.innerHTML = `
    <div class="admin-tabs" role="tablist">
      <button type="button" data-tab="vendors" class="${tab === "vendors" ? "is-active" : ""}" role="tab" aria-selected="${tab === "vendors"}">Vendors</button>
      <button type="button" data-tab="moderation" class="${tab === "moderation" ? "is-active" : ""}" role="tab" aria-selected="${tab === "moderation"}">Moderation</button>
      <button type="button" data-tab="orders" class="${tab === "orders" ? "is-active" : ""}" role="tab" aria-selected="${tab === "orders"}">Orders</button>
    </div>
    <div id="admin-panel" aria-busy="true"><div class="skeleton skeleton-card"></div></div>
  `;

  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("data-tab");
      if (next === "vendors" || next === "moderation" || next === "orders") {
        tab = next;
        render();
      }
    });
  });

  const panel = root.querySelector("#admin-panel");
  if (!(panel instanceof HTMLElement)) return;

  try {
    if (tab === "vendors") await renderVendors(panel);
    else if (tab === "moderation") await renderModeration(panel);
    else await renderOrders(panel);
  } catch (error) {
    console.error("Admin tab:", error);
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(panel, message, () => render());
  }
}

/**
 * @param {HTMLElement} panel
 */
async function renderVendors(panel) {
  const rows = await listVendorApplications();
  panel.setAttribute("aria-busy", "false");
  if (!rows.length) {
    panel.innerHTML = `<p class="empty">No vendor applications yet.</p>`;
    return;
  }

  panel.innerHTML = `
    <div class="admin-list">
      ${rows.map((row) => `
        <article class="order-card">
          <div class="address-card-head">
            <strong>${escapeHtml(row.shopName)}</strong>
            <span class="status-badge is-${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
          </div>
          <p class="muted">${escapeHtml(row.applicant)} · ${escapeHtml(formatWhen(row.createdAt))}</p>
          <div class="order-actions">
            <button class="button button-primary" type="button" data-vendor="${escapeHtml(row.id)}" data-status="approved">Approve</button>
            <button class="button button-ghost" type="button" data-vendor="${escapeHtml(row.id)}" data-status="suspended" data-label="Reject">Reject</button>
            <button class="button button-ghost" type="button" data-vendor="${escapeHtml(row.id)}" data-status="suspended">Suspend</button>
          </div>
        </article>
      `).join("")}
    </div>
    <p class="muted">Reject and Suspend both set status to suspended. There is no rejected value.</p>
  `;

  panel.querySelectorAll("[data-vendor]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-vendor") || "";
      const status = button.getAttribute("data-status") || "";
      const label = button.getAttribute("data-label") || status;
      if (!id || (status !== "approved" && status !== "suspended" && status !== "pending")) return;
      openModal({
        title: label === "Reject" ? "Reject shop" : `${label} shop`,
        body: label === "Reject"
          ? "Set this shop to suspended? There is no rejected status."
          : `Set this shop to ${status}?`,
        confirmLabel: label === "Reject" ? "Reject" : status,
        onConfirm: async () => {
          try {
            await setVendorStatus(id, status);
            toast(`Shop set to ${status}.`, "success");
            await render();
          } catch (error) {
            console.error("setVendorStatus:", error);
            toast(authErrorMessage(error), "error");
          }
        },
      });
    });
  });
}

/**
 * @param {HTMLElement} panel
 */
async function renderModeration(panel) {
  const [reels, products] = await Promise.all([listModerationReels(), listModerationProducts()]);
  panel.setAttribute("aria-busy", "false");
  panel.innerHTML = `
    <h2>Reels</h2>
    <div class="admin-list">
      ${reels.length ? reels.map((reel) => `
        <article class="order-card">
          <div class="address-card-head">
            <strong>${escapeHtml(reel.caption)}</strong>
            <span class="status-badge is-${escapeHtml(reel.status)}">${escapeHtml(reel.status)}</span>
          </div>
          <p class="muted">${escapeHtml(reel.shopName)} · ${escapeHtml(formatWhen(reel.createdAt))}</p>
          ${reel.status === "removed" ? "" : `
            <div class="order-actions">
              <button class="button button-ghost" type="button" data-remove-reel="${escapeHtml(reel.id)}">Remove</button>
            </div>
          `}
        </article>
      `).join("") : `<p class="empty">No reels.</p>`}
    </div>
    <h2>Products</h2>
    <div class="admin-list">
      ${products.length ? products.map((product) => `
        <article class="order-card">
          <div class="address-card-head">
            <strong>${escapeHtml(product.title)}</strong>
            <span class="status-badge is-${escapeHtml(product.status)}">${escapeHtml(product.status)}</span>
          </div>
          <p class="muted">${escapeHtml(product.shopName)} · ${escapeHtml(formatWhen(product.createdAt))}</p>
          ${product.status === "archived" ? "" : `
            <div class="order-actions">
              <button class="button button-ghost" type="button" data-archive-product="${escapeHtml(product.id)}">Remove</button>
            </div>
          `}
        </article>
      `).join("") : `<p class="empty">No products.</p>`}
    </div>
  `;

  panel.querySelectorAll("[data-remove-reel]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-remove-reel") || "";
      openModal({
        title: "Remove reel",
        body: "Set this reel to removed? It stays in the database and leaves the public feed.",
        confirmLabel: "Remove",
        onConfirm: async () => {
          try {
            await removeReel(id);
            toast("Reel removed.", "success");
            await render();
          } catch (error) {
            console.error("removeReel:", error);
            toast(authErrorMessage(error), "error");
          }
        },
      });
    });
  });

  panel.querySelectorAll("[data-archive-product]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-archive-product") || "";
      openModal({
        title: "Remove product",
        body: "Set this product to archived? It stays in the database and leaves the catalog.",
        confirmLabel: "Remove",
        onConfirm: async () => {
          try {
            await archiveProduct(id);
            toast("Product archived.", "success");
            await render();
          } catch (error) {
            console.error("archiveProduct:", error);
            toast(authErrorMessage(error), "error");
          }
        },
      });
    });
  });
}

/**
 * @param {HTMLElement} panel
 */
async function renderOrders(panel) {
  const rows = await listAllOrders();
  panel.setAttribute("aria-busy", "false");
  if (!rows.length) {
    panel.innerHTML = `<p class="empty">No orders yet.</p>`;
    return;
  }

  panel.innerHTML = `
    <div class="admin-list">
      ${rows.map((order) => `
        <article class="order-card">
          <div class="address-card-head">
            <a class="title-link" href="${url("pages/account/order.html")}?id=${encodeURIComponent(order.id)}">
              Order ${escapeHtml(order.id.slice(0, 8))}
            </a>
            <span class="status-badge is-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <div class="order-meta">
            <span>${escapeHtml(order.customer)}</span>
            <span>${escapeHtml(formatMoney(order.total, order.currency))}</span>
            <span>${escapeHtml(formatWhen(order.createdAt))}</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

/**
 * @param {string} value
 * @returns {string}
 */
function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
