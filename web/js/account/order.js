import { mountAccountNav } from "../accountShell.js";
import { addToCart } from "../api/cartApi.js";
import { cancelMyOrder, getMyOrder, requestOrderRefund } from "../api/ordersApi.js";
import { refundOrder } from "../api/adminApi.js";
import { authErrorMessage, requireUser } from "../auth.js?v=3";
import { mountShell, openModal, toast } from "../components.js?v=16";
import { formatMoney } from "../format.js";
import { escapeHtml } from "../html.js";
import { pickProductImage, productImageUrl } from "../media.js";
import { url } from "../paths.js?v=4";
import { showState } from "../ui-state.js";

const root = document.querySelector("#order-root");

/** @type {import("../auth.js?v=3").Profile | null} */
let viewer = null;

/** Order flow steps for the timeline. Cancelled / refunded are handled separately. */
const FLOW = ["pending", "paid", "processing", "shipped", "delivered"];

boot();

async function boot() {
  const profile = await requireUser();
  if (!profile) return;
  viewer = profile;
  mountShell({ page: "account" });
  mountAccountNav("orders");
  await load();
}

async function load() {
  if (!root) return;
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    showState(root, "Choose an order from your order list.", () => {
      window.location.assign(url("pages/account/orders.html"));
    });
    return;
  }

  root.setAttribute("aria-busy", "true");
  try {
    const order = await getMyOrder(id);
    if (!order) {
      showState(root, "This order was not found.");
      return;
    }
    document.title = `Order ${shortId(order.id)} — EME`;
    render(order);
  } catch (error) {
    console.error("Order detail:", error);
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
  }
}

/**
 * @param {object} order
 */
function render(order) {
  if (!root) return;
  const address = order.shipping_address || {};
  const payment = Array.isArray(order.payments) ? order.payments[0] : null;
  const canCancel = order.status === "pending" && viewer?.id === order.customer_id;
  const disputes = order.disputes || [];
  const openDispute = disputes.find((row) => row.status === "open" || row.status === "investigating");
  const canRequestRefund = viewer?.id === order.customer_id
    && order.status === "delivered"
    && order.payment_status !== "refunded"
    && order.payment_status !== "failed"
    && !openDispute;
  const canAdminRefund = viewer?.role === "admin" && order.status === "delivered";

  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <div class="address-card-head">
      <h1>Order ${escapeHtml(shortId(order.id))}</h1>
      <span class="status-badge is-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
    </div>
    <p class="muted">${escapeHtml(formatDate(order.created_at))}</p>

    <section class="account-card">
      <h2>Status / অবস্থা</h2>
      <ol class="timeline">${timelineHtml(order.status)}</ol>
      <p class="muted">Payment: <span class="status-badge is-${escapeHtml(order.payment_status)}">${escapeHtml(order.payment_status)}</span>
        ${payment ? ` · ${escapeHtml(paymentLabel(payment.provider))} · ${escapeHtml(payment.status)}` : ""}</p>
      ${payment?.provider === "cash_on_delivery" && order.payment_status === "pending"
        ? `<p class="muted">Cash on delivery is marked paid when this order is delivered.</p>`
        : ""}
    </section>

    <section class="account-card">
      <h2>Shipping address</h2>
      <p><strong>${escapeHtml(address.recipient_name || "")}</strong> · ${escapeHtml(address.phone || "")}</p>
      <p>${escapeHtml(address.line1 || "")}${address.line2 ? `, ${escapeHtml(address.line2)}` : ""}</p>
      <p class="muted">${escapeHtml(address.city || "")}, ${escapeHtml(address.district || "")}${address.postal_code ? ` · ${escapeHtml(address.postal_code)}` : ""}</p>
    </section>

    ${(order.shops || []).map((group) => `
      <section class="account-card">
        <h2>${escapeHtml(group.shop?.shop_name || "Shop")}</h2>
        ${group.items.map((item) => itemHtml(item, order.currency)).join("")}
      </section>
    `).join("")}

    <section class="account-card">
      <h2>Totals</h2>
      <p class="checkout-line"><span>Subtotal</span><strong>${escapeHtml(formatMoney(order.subtotal, order.currency))}</strong></p>
      <p class="checkout-line"><span>Shipping</span><strong>${escapeHtml(formatMoney(order.shipping_fee, order.currency))}</strong></p>
      <p class="checkout-line"><span>Total</span><strong>${escapeHtml(formatMoney(order.total, order.currency))}</strong></p>
      <div class="order-actions">
        <button class="button button-primary" type="button" id="buy-again">Buy again</button>
        <button class="button button-ghost" type="button" id="print-invoice">Print invoice</button>
        ${canCancel ? `<button class="button button-ghost" type="button" id="cancel-order">Cancel order</button>` : ""}
        ${canAdminRefund ? `<button class="button button-ghost" type="button" id="admin-refund">Refund order</button>` : ""}
        <a class="button button-ghost" href="${url("pages/account/orders.html")}">Back to orders</a>
      </div>
      ${canCancel ? `<p class="muted">You can cancel while the order is still pending. Stock is restored.</p>` : ""}
    </section>

    ${disputes.length || canRequestRefund ? `
      <section class="account-card">
        <h2>Refund</h2>
        ${disputes.map((row) => `
          <p><span class="status-badge is-${escapeHtml(row.status)}">${escapeHtml(row.status)}</span> ${escapeHtml(row.reason)}</p>
          ${row.resolution_note ? `<p class="muted">${escapeHtml(row.resolution_note)}</p>` : ""}
        `).join("")}
        ${canRequestRefund ? `
          <form id="refund-form">
            <label class="field">
              <span>Why do you want a refund?</span>
              <textarea name="reason" rows="3" minlength="3" maxlength="2000" required></textarea>
            </label>
            <button class="button button-ghost" type="submit">Request refund</button>
          </form>
          <p class="muted">This opens a request. An admin marks the payment refunded. Stock is not returned automatically.</p>
        ` : ""}
      </section>
    ` : ""}
  `;

  root.querySelector("#buy-again")?.addEventListener("click", async () => {
    const button = root.querySelector("#buy-again");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      const flat = order.order_items || [];
      let added = 0;
      for (const item of flat) {
        try {
          await addToCart(item.product_id, item.quantity);
          added += 1;
        } catch (lineError) {
          console.error("Buy again line:", lineError);
        }
      }
      if (!added) throw new Error("None of these products could be added to the cart.");
      toast(`Added ${added} item${added === 1 ? "" : "s"} to your cart.`, "success");
      window.location.assign(url("pages/cart.html"));
    } catch (error) {
      console.error("Buy again:", error);
      toast(authErrorMessage(error), "error");
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });

  root.querySelector("#print-invoice")?.addEventListener("click", () => {
    window.print();
  });

  root.querySelector("#refund-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const reason = String(new FormData(form).get("reason") || "").trim();
    const button = form.querySelector("button");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await requestOrderRefund(order.id, reason);
      toast("Refund request sent.", "success");
      await load();
    } catch (error) {
      console.error("Request refund:", error);
      toast(authErrorMessage(error), "error");
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });

  root.querySelector("#admin-refund")?.addEventListener("click", () => {
    openModal({
      title: "Refund order",
      body: "Mark this delivered order and its payment as refunded? Stock stays as it is.",
      confirmLabel: "Refund",
      onConfirm: async () => {
        try {
          await refundOrder(order.id, "Refunded from the order page.");
          toast("Order refunded.", "success");
          await load();
        } catch (error) {
          console.error("Admin refund:", error);
          toast(authErrorMessage(error), "error");
        }
      },
    });
  });

  root.querySelector("#cancel-order")?.addEventListener("click", () => {
    openModal({
      title: "Cancel order",
      body: "Cancel this pending order? Stock will be restored.",
      confirmLabel: "Cancel order",
      onConfirm: async () => {
        try {
          await cancelMyOrder(order.id);
          toast("Order cancelled.", "success");
          await load();
        } catch (error) {
          console.error("Cancel order:", error);
          toast(authErrorMessage(error), "error");
        }
      },
    });
  });
}

/**
 * @param {object} item
 * @param {string} currency
 * @returns {string}
 */
function itemHtml(item, currency) {
  const product = Array.isArray(item.products) ? item.products[0] : item.products;
  const image = pickProductImage(product?.product_images);
  const src = image ? productImageUrl(image.storage_path) : "";
  const thumb = src
    ? `<img src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<span class="product-fallback">${escapeHtml((item.title || "?").slice(0, 1))}</span>`;

  return `
    <article class="order-item-row">
      <div class="order-item-thumb">${thumb}</div>
      <div>
        <p><strong>${escapeHtml(item.title)}</strong></p>
        <p class="muted">Qty ${escapeHtml(String(item.quantity))} · ${escapeHtml(item.item_status)}</p>
      </div>
      <p>${escapeHtml(formatMoney(item.line_total, currency))}</p>
    </article>
  `;
}

/**
 * @param {string} status
 * @returns {string}
 */
function timelineHtml(status) {
  if (status === "cancelled" || status === "refunded") {
    return `<li class="is-done">${escapeHtml(status)}</li>`;
  }
  const index = FLOW.indexOf(status);
  return FLOW.map((step, i) => `
    <li class="${i <= index ? "is-done" : ""}">${escapeHtml(step)}</li>
  `).join("");
}

/**
 * @param {string} id
 * @returns {string}
 */
/**
 * @param {string} provider
 * @returns {string}
 */
function paymentLabel(provider) {
  if (provider === "cash_on_delivery") return "Cash on delivery";
  return provider;
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
