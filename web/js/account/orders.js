import { mountAccountNav } from "../accountShell.js";
import { listMyOrders, ORDERS_PAGE_SIZE } from "../api/ordersApi.js";
import { authErrorMessage, requireUser } from "../auth.js?v=3";
import { mountShell, toast } from "../components.js?v=16";
import { formatMoney } from "../format.js";
import { escapeHtml } from "../html.js";
import { url } from "../paths.js?v=4";
import { showState } from "../ui-state.js";

const root = document.querySelector("#orders-root");
const more = document.querySelector("#orders-more");
const form = document.querySelector("#order-filters");

/** @type {Array<object>} */
let rows = [];
let total = 0;
let page = 1;

boot();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const status = String(new FormData(form).get("status") || "");
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  window.location.assign(`${url("pages/account/orders.html")}${params.toString() ? `?${params}` : ""}`);
});

async function boot() {
  const profile = await requireUser();
  if (!profile) return;
  mountShell({ page: "account" });
  mountAccountNav("orders");

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "";
  const select = form?.querySelector("[name='status']");
  if (select instanceof HTMLSelectElement) select.value = status;
  page = Math.max(1, Number(params.get("page")) || 1);
  await load();
}

async function load() {
  if (!root) return;
  root.setAttribute("aria-busy", "true");
  const status = new URLSearchParams(window.location.search).get("status") || "";

  try {
    const result = await listMyOrders({
      status: status || undefined,
      limit: page * ORDERS_PAGE_SIZE,
      offset: 0,
    });
    rows = result.rows;
    total = result.total;
    render(status);
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
    if (more) more.innerHTML = "";
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
        <p>${status ? "No orders with that status." : "You have not placed any orders yet."}</p>
        <a class="button button-primary" href="${url("pages/products.html")}">Start shopping</a>
      </div>
    `;
    if (more) more.innerHTML = "";
    return;
  }

  root.innerHTML = `
    <div class="order-list">
      ${rows.map((order) => `
        <article class="order-card">
          <div class="address-card-head">
            <a class="title-link" href="${url("pages/account/order.html")}?id=${encodeURIComponent(order.id)}">
              Order ${escapeHtml(shortId(order.id))}
            </a>
            <span class="status-badge is-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <div class="order-meta">
            <span>${escapeHtml(formatDate(order.created_at))}</span>
            <span>${escapeHtml(formatMoney(order.total, order.currency))}</span>
            <span class="status-badge is-${escapeHtml(order.payment_status)}">${escapeHtml(order.payment_status)}</span>
            <span>${escapeHtml(String(order.itemCount))} item${order.itemCount === 1 ? "" : "s"}</span>
          </div>
          <p class="muted">${escapeHtml(order.shopNames.join(" · ") || "Marketplace seller")}</p>
          <div class="order-actions">
            <a class="button button-ghost" href="${url("pages/account/order.html")}?id=${encodeURIComponent(order.id)}">View details</a>
          </div>
        </article>
      `).join("")}
    </div>
  `;

  if (more) {
    more.innerHTML = rows.length < total
      ? `<a class="button button-ghost" href="${escapeHtml(nextHref(page + 1))}">Load more</a>`
      : "";
  }
}

/**
 * @param {number} nextPage
 * @returns {string}
 */
function nextHref(nextPage) {
  const params = new URLSearchParams(window.location.search);
  params.set("page", String(nextPage));
  return `${url("pages/account/orders.html")}?${params}`;
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
    hour: "2-digit",
    minute: "2-digit",
  });
}
