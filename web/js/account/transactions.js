import { mountAccountNav } from "../accountShell.js";
import { listMyTransactions } from "../api/ordersApi.js";
import { authErrorMessage, requireUser } from "../auth.js?v=3";
import { mountShell, toast } from "../components.js?v=6";
import { formatMoney } from "../format.js";
import { escapeHtml } from "../html.js";
import { t } from "../i18n.js";
import { url } from "../paths.js?v=4";
import { showState } from "../ui-state.js";

const root = document.querySelector("#transactions-root");

boot();

async function boot() {
  const profile = await requireUser();
  if (!profile || !(root instanceof HTMLElement)) return;
  mountShell({ page: "account" });
  mountAccountNav("transactions");
  await load();
}

async function load() {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "true");
  try {
    const rows = await listMyTransactions();
    render(rows);
  } catch (error) {
    console.error("Transactions:", error);
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
  }
}

/**
 * @param {Array<object>} rows
 */
function render(rows) {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "false");
  if (!rows.length) {
    root.innerHTML = `
      <div class="state-panel">
        <p>${escapeHtml(t("noTransactions"))}</p>
        <a class="button button-primary" href="${url("pages/products.html")}">${escapeHtml(t("startShopping"))}</a>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="admin-list">
      ${rows.map((row) => {
        const when = row.created_at ? new Date(row.created_at).toLocaleString() : "";
        const orderHref = `${url("pages/account/order.html")}?id=${encodeURIComponent(row.order_id)}`;
        return `
          <article class="account-card">
            <strong>${escapeHtml(String(row.provider || ""))}</strong>
            <p>${escapeHtml(formatMoney(row.amount, row.currency))} · ${escapeHtml(String(row.status || ""))}</p>
            <p class="muted">${escapeHtml(t("reference"))}: ${escapeHtml(String(row.provider_reference || ""))}</p>
            <p class="muted">${escapeHtml(when)}</p>
            <a href="${orderHref}">${escapeHtml(t("order"))}</a>
          </article>
        `;
      }).join("")}
    </div>
  `;
}
