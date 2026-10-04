/**
 * Catalog chat. Answers from products and shops already in Supabase.
 * No extra API. It does not invent prices or shops.
 */

import { listProducts } from "./api/productsApi.js";
import { listApprovedShops } from "./api/shopsApi.js";
import { escapeHtml } from "./html.js";
import { formatMoney } from "./format.js";
import { t } from "./i18n.js?v=11";
import { icon } from "./icons.js";
import { url } from "./paths.js?v=4";
import { shopOf } from "./shopView.js";

const STOP = new Set([
  "the", "a", "an", "is", "are", "of", "for", "to", "and", "or", "in", "on",
  "what", "which", "where", "how", "much", "price", "stock", "shop", "product",
  "about", "please", "ki", "koto", "dam", "ache",
  "কি", "কী", "কত", "দাম", "আছে", "পণ্য", "দোকান", "সম্পর্কে", "জানা", "জানতে",
  "চাই", "এর", "এই", "একটা", "কোন", "কোথায়", "স্টক",
]);

/**
 * Mounts the corner chat once per page.
 */
export function mountShopChat() {
  if (document.querySelector("[data-shop-chat]")) return;
  const root = document.createElement("div");
  root.className = "shop-chat";
  root.setAttribute("data-shop-chat", "");
  root.innerHTML = `
    <button class="shop-chat-open" type="button" data-chat-open>${icon("comment")}<span>${escapeHtml(t("chatAsk"))}</span></button>
    <section class="shop-chat-panel" hidden data-chat-panel>
      <header class="shop-chat-head">
        <strong>${escapeHtml(t("chatTitle"))}</strong>
        <button type="button" data-chat-close aria-label="${escapeHtml(t("chatClose"))}">×</button>
      </header>
      <div class="shop-chat-log" data-chat-log>
        <p class="shop-chat-note">${escapeHtml(t("chatHint"))}</p>
      </div>
      <form class="shop-chat-form" data-chat-form>
        <input name="q" type="text" maxlength="120" placeholder="${escapeHtml(t("chatPlaceholder"))}" autocomplete="off" required>
        <button class="button button-primary" type="submit">${escapeHtml(t("chatSend"))}</button>
      </form>
    </section>
  `;
  document.body.append(root);

  const panel = root.querySelector("[data-chat-panel]");
  const log = root.querySelector("[data-chat-log]");
  const form = root.querySelector("[data-chat-form]");
  root.querySelector("[data-chat-open]")?.addEventListener("click", () => {
    if (!(panel instanceof HTMLElement)) return;
    panel.hidden = false;
    panel.querySelector("input")?.focus();
  });
  root.querySelector("[data-chat-close]")?.addEventListener("click", () => {
    if (panel instanceof HTMLElement) panel.hidden = true;
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(form instanceof HTMLFormElement) || !(log instanceof HTMLElement)) return;
    const data = new FormData(form);
    const question = String(data.get("q") || "").trim();
    if (!question) return;
    form.reset();
    log.insertAdjacentHTML("beforeend", `<p class="shop-chat-me">${escapeHtml(question)}</p>`);
    const pending = document.createElement("p");
    pending.className = "shop-chat-bot";
    pending.textContent = "…";
    log.append(pending);
    log.scrollTop = log.scrollHeight;
    try {
      pending.innerHTML = await answerQuestion(question);
    } catch (error) {
      console.error("shop chat:", error);
      pending.textContent = t("chatNoMatch");
    }
    log.scrollTop = log.scrollHeight;
  });
}

/**
 * @param {string} question
 * @returns {Promise<string>}
 */
async function answerQuestion(question) {
  const lower = question.toLowerCase();
  if (/delivery|ডেলিভারি|cod|ক্যাশ|return|রিটার্ন/.test(lower)) {
    return `<p>${escapeHtml(t("chatDelivery"))}</p>`;
  }
  if (/\blive\b|লাইভ/.test(lower)) {
    return `<p>${escapeHtml(t("chatLive"))} <a href="${url("pages/lives.html")}">${escapeHtml(t("live"))}</a></p>`;
  }

  const words = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1 && !STOP.has(word));
  const term = words.join(" ") || question.trim();
  if (term.length < 2) return `<p>${escapeHtml(t("chatHint"))}</p>`;

  let products = (await listProducts({ q: term, limit: 3 })).rows;
  if (!products.length && words.length > 1) {
    products = (await listProducts({ q: words[0], limit: 3 })).rows;
  }
  let shops = await listApprovedShops({ q: term, limit: 2 });
  if (!shops.length && words[0]) shops = await listApprovedShops({ q: words[0], limit: 2 });

  if (!products.length && !shops.length) return `<p>${escapeHtml(t("chatNoMatch"))}</p>`;

  const productHtml = products.map((product) => {
    const shop = shopOf(product)?.shop_name || "";
    const stock = Number(product.stock) > 0 ? t("inStock") : t("outOfStock");
    const href = `${url("pages/product.html")}?slug=${encodeURIComponent(product.slug)}`;
    return `<li><a href="${href}">${escapeHtml(product.title)}</a> — ${escapeHtml(formatMoney(product.price, product.currency))}${shop ? ` · ${escapeHtml(shop)}` : ""} · ${escapeHtml(stock)}</li>`;
  }).join("");
  const shopHtml = shops.map((shop) => {
    const href = `${url("pages/shop.html")}?slug=${encodeURIComponent(shop.slug)}`;
    const about = shop.description ? ` — ${escapeHtml(String(shop.description).slice(0, 80))}` : "";
    return `<li><a href="${href}">${escapeHtml(shop.shop_name)}</a>${about}</li>`;
  }).join("");

  return `
    ${products.length ? `<p><strong>${escapeHtml(t("chatProducts"))}</strong></p><ul>${productHtml}</ul>` : ""}
    ${shops.length ? `<p><strong>${escapeHtml(t("chatShops"))}</strong></p><ul>${shopHtml}</ul>` : ""}
  `;
}
