import { getMyShopApplication } from "./api/shopsApi.js";
import {
  ITEM_STATUS_NEXT,
  listVendorOrderItems,
  ORDERS_PAGE_SIZE,
  vendorSetItemStatus,
} from "./api/ordersApi.js";
import { authErrorMessage, requireUser } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js";
import { formatMoney } from "./format.js";
import { escapeHtml } from "./html.js";
import { url } from "./paths.js";
import { showState } from "./ui-state.js";

mountShell({ page: "account" });

const root = document.querySelector("#vendor-orders-root");
const form = document.querySelector("#vendor-order-filters");

/** @type {Array<object>} */
let rows = [];
let total = 0;

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const status = String(new FormData(form).get("status") || "");
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  window.location.assign(
    `${url("pages/vendor-orders.html")}${params.toString() ? `?${params}` : ""}`,
  );
});

boot();

async function boot() {
  const profile = await requireUser();
  if (!profile) return;

  try {
    const shop = await getMyShopApplication();
    if (!shop || shop.status !== "approved") {
      if (root) {
        root.setAttribute("aria-busy", "false");
        showState(
          root,
          "Only approved vendors can manage shop orders.",
          () => window.location.assign(url("pages/sell.html")),
        );
      }
      return;
    }
  } catch (error) {
    console.error("Vendor shop check:", error);
    toast(authErrorMessage(error), "error");
  }

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "";
  const select = form?.querySelector("[name='status']");
  if (select instanceof HTMLSelectElement) select.value = status;

  await load(status);
}

/**
 * @param {string} status
 */
async function load(status) {
  if (!root) return;
  root.setAttribute("aria-busy", "true");
  try {
    const result = await listVendorOrderItems({
      itemStatus: status || undefined,
      limit: ORDERS_PAGE_SIZE * 3,
      offset: 0,
    });
    rows = result.rows;
    total = result.total;
    render(status);
  } catch (error) {
    console.error("Vendor orders:", error);
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load(status));
  }
}

/**
 * @param {string} status
 */
function render(status) {
  if (!root) return;
  root.setAttribute("aria-busy", "false");

  if (!rows.length) {
    root.innerHTML = `
      <div class="state-panel">
        <p>${status ? "No lines with that status." : "No orders for your products yet."}</p>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <p class="muted">${escapeHtml(String(total))} line${total === 1 ? "" : "s"}</p>
    <div class="order-list">
      ${rows.map((row) => rowHtml(row)).join("")}
    </div>
  `;

  root.querySelectorAll("[data-set-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!(button instanceof HTMLButtonElement)) return;
      const itemId = button.getAttribute("data-item") || "";
      const next = button.getAttribute("data-set-status") || "";
      if (!itemId || !next) return;
      button.disabled = true;
      try {
        await vendorSetItemStatus(itemId, next);
        toast(`Updated to ${next}.`, "success");
        await load(status);
      } catch (error) {
        console.error("Update item status:", error);
        toast(authErrorMessage(error), "error");
        button.disabled = false;
      }
    });
  });
}

/**
 * @param {object} row
 * @returns {string}
 */
function rowHtml(row) {
  const order = row.order || {};
  const address = order.shipping_address || {};
  const next = ITEM_STATUS_NEXT[row.item_status] || [];
  const actions = next
    .map((status) => {
      const label = status === "processing" ? "Confirm / processing" : status;
      return `<button class="button button-ghost" type="button" data-item="${escapeHtml(row.id)}" data-set-status="${escapeHtml(status)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  return `
    <article class="order-card vendor-order-card">
      <div class="address-card-head">
        <strong>${escapeHtml(row.title)}</strong>
        <span class="status-badge is-${escapeHtml(row.item_status)}">${escapeHtml(row.item_status)}</span>
      </div>
      <div class="order-meta">
        <span>Order ${escapeHtml(shortId(order.id))}</span>
        <span>${escapeHtml(formatDate(order.created_at || row.created_at))}</span>
        <span>Qty ${escapeHtml(String(row.quantity))}</span>
        <span>${escapeHtml(formatMoney(row.line_total, order.currency || "BDT"))}</span>
      </div>
      <p class="muted">
        Ship to ${escapeHtml(address.recipient_name || "—")} · ${escapeHtml(address.phone || "")}
        · ${escapeHtml(address.city || "")}, ${escapeHtml(address.district || "")}
      </p>
      <p class="muted">Order status: ${escapeHtml(order.status || "—")}</p>
      <div class="order-actions">${actions || `<span class="muted">No further actions</span>`}</div>
    </article>
  `;
}

/**
 * @param {string} id
 * @returns {string}
 */
function shortId(id) {
  return String(id || "").slice(0, 8);
}

/**
 * @param {string} value
 * @returns {string}
 */
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
