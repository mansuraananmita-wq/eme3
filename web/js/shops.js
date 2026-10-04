import { listApprovedShops } from "./api/shopsApi.js";
import { authErrorMessage } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=6";
import { escapeHtml } from "./html.js";
import { shopCardHtml } from "./shopView.js";
import { showState } from "./ui-state.js";
import { url } from "./paths.js?v=4";

mountShell({ page: "shops" });

const root = document.querySelector("#shops-grid");
const form = document.querySelector("#shop-search");
const summary = document.querySelector("#shops-summary");

load();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const q = String(new FormData(form).get("q") || "").trim();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  window.location.assign(`${url("pages/shops.html")}${params.toString() ? `?${params}` : ""}`);
});

async function load() {
  if (!root) return;
  const q = new URLSearchParams(window.location.search).get("q") || "";
  const field = form?.querySelector("[name='q']");
  if (field instanceof HTMLInputElement) field.value = q;

  try {
    const shops = await listApprovedShops({ q, limit: 48 });
    if (summary) {
      summary.textContent = q
        ? `${shops.length} store${shops.length === 1 ? "" : "s"} for “${q}”`
        : `${shops.length} approved store${shops.length === 1 ? "" : "s"}`;
    }
    if (!shops.length) {
      showState(root, q ? "No stores match that search." : "No approved stores yet.");
      return;
    }
    root.setAttribute("aria-busy", "false");
    root.innerHTML = shops.map((shop) => shopCardHtml(shop)).join("");
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
  }
}
