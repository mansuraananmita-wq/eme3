/**
 * Once-per-day promo popup. Skipped on cart, checkout, and auth pages.
 */

import { PROMO_POPUP } from "./data/banners.js";
import { escapeHtml } from "./html.js";
import { t } from "./i18n.js?v=14";
import { url } from "./paths.js?v=4";

const STORAGE_KEY = "eme_promo_popup_day";

/**
 * @returns {boolean}
 */
function shouldSkipPage() {
  const path = window.location.pathname.replaceAll("\\", "/").toLowerCase();
  return /\/(cart|checkout|login|register)\.html$/.test(path)
    || /\/account\//.test(path);
}

/**
 * @returns {string}
 */
function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/**
 * @returns {boolean}
 */
function alreadyShownToday() {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayKey();
  } catch {
    return true;
  }
}

/**
 * @param {boolean} remember
 */
function markShown(remember) {
  if (!remember) return;
  try {
    localStorage.setItem(STORAGE_KEY, todayKey());
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Mounts the popup into #modal-root when allowed.
 */
export function maybeShowPromoPopup() {
  if (shouldSkipPage() || alreadyShownToday() || !PROMO_POPUP) return;

  const root = document.querySelector("#modal-root");
  if (!root || root.innerHTML.trim()) return;

  const href = url(PROMO_POPUP.href);
  const image = url(PROMO_POPUP.image);

  root.innerHTML = `
    <div class="modal-backdrop promo-popup" data-promo-close>
      <div class="modal promo-popup-card" role="dialog" aria-modal="true" aria-labelledby="promo-title">
        <button class="icon-button promo-popup-x" type="button" data-promo-close aria-label="${escapeHtml(t("close"))}">×</button>
        <img src="${escapeHtml(image)}" alt="" width="600" height="200" loading="lazy">
        <h2 id="promo-title">${escapeHtml(t("promoTitle"))}</h2>
        <p>${escapeHtml(t("promoBody"))}</p>
        <div class="promo-popup-actions">
          <a class="button button-primary" href="${href}">${escapeHtml(t("promoCta"))}</a>
          <label class="promo-popup-check">
            <input type="checkbox" data-promo-hide checked>
            ${escapeHtml(t("promoHide"))}
          </label>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    const hide = root.querySelector("[data-promo-hide]");
    markShown(hide instanceof HTMLInputElement ? hide.checked : true);
    root.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  };

  const onKey = (event) => {
    if (event.key === "Escape") close();
  };

  document.addEventListener("keydown", onKey);
  root.querySelectorAll("[data-promo-close]").forEach((node) => {
    node.addEventListener("click", (event) => {
      if (event.target === event.currentTarget || event.currentTarget.matches("button")) close();
    });
  });
}
