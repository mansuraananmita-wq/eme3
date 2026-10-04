/**
 * Live list page controller.
 */

import { listLiveNow, listUpcomingLives } from "./api/liveApi.js";
import { authErrorMessage } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=16";
import { escapeHtml } from "./html.js";
import { isSupabaseConfigured } from "./supabaseClient.js";
import { url } from "./paths.js?v=4";
import { showState, syncConfigBanner } from "./ui-state.js";
import { shopHref, shopLogoHtml } from "./shopView.js";

mountShell({ page: "lives" });

const liveRoot = document.querySelector("#lives-now");
const upcomingRoot = document.querySelector("#lives-upcoming");

loadLives();

async function loadLives() {
  syncConfigBanner(isSupabaseConfigured());
  if (!isSupabaseConfigured()) {
    const message = "Set SUPABASE_URL and SUPABASE_ANON_KEY in web/js/config.js";
    if (liveRoot instanceof HTMLElement) showState(liveRoot, escapeHtml(message));
    if (upcomingRoot instanceof HTMLElement) showState(upcomingRoot, escapeHtml(message));
    return;
  }

  try {
    const [live, upcoming] = await Promise.all([listLiveNow({ limit: 24 }), listUpcomingLives({ limit: 24 })]);
    renderSection(liveRoot, live, "No live streams right now.", true);
    renderSection(upcomingRoot, upcoming, "No upcoming lives scheduled.", false);
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    const retry = () => loadLives();
    if (liveRoot instanceof HTMLElement) showState(liveRoot, escapeHtml(message), retry);
    if (upcomingRoot instanceof HTMLElement) showState(upcomingRoot, escapeHtml(message), retry);
  }
}

/**
 * @param {Element | null} root
 * @param {Array<object>} rows
 * @param {string} emptyMessage
 * @param {boolean} isLive
 */
function renderSection(root, rows, emptyMessage, isLive) {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "false");
  if (!rows.length) {
    showState(root, emptyMessage);
    return;
  }
  root.innerHTML = rows.map((stream) => cardHtml(stream, isLive)).join("");
}

/**
 * @param {object} stream
 * @param {boolean} isLive
 * @returns {string}
 */
function cardHtml(stream, isLive) {
  const href = `${url("pages/live.html")}?id=${encodeURIComponent(stream.id)}`;
  const shop = stream.shop;
  const shopLink = shop?.slug ? shopHref(shop.slug) : url("pages/shops.html");
  const thumb = stream.thumbnailUrl
    ? `<img src="${escapeHtml(stream.thumbnailUrl)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<span class="live-card-fallback">${escapeHtml((stream.title || "L").slice(0, 1))}</span>`;
  const when = isLive
    ? "Live now"
    : stream.scheduledAt
      ? `Starts ${formatWhen(stream.scheduledAt)}`
      : "Scheduled";
  const peak =
    Number(stream.peakViewers) > 0 ? ` · Peak ${stream.peakViewers}` : "";

  return `
    <article class="live-card">
      <a class="live-card-media" href="${href}">
        ${thumb}
        <span class="live-badge ${isLive ? "is-live" : ""}">${isLive ? "LIVE" : "UPCOMING"}</span>
      </a>
      <div class="live-card-body">
        <a class="live-card-shop" href="${shopLink}">
          ${shopLogoHtml(shop, "shop-logo-xs")}
          <span>${escapeHtml(shop?.shop_name || "Shop")}</span>
        </a>
        <h3><a href="${href}">${escapeHtml(stream.title)}</a></h3>
        <p class="live-card-meta">${escapeHtml(when)}${escapeHtml(peak)}</p>
      </div>
    </article>
  `;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatWhen(iso) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
