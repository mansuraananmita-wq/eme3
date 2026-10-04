import { mountAccountNav } from "./accountShell.js";
import { listSavedReels } from "./api/reelsApi.js";
import { authErrorMessage, requireUser } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=14";
import { escapeHtml } from "./html.js";
import { t } from "./i18n.js?v=14";
import { url } from "./paths.js?v=4";
import { showState } from "./ui-state.js";

const root = document.querySelector("#saved-reels-root");

start();

async function start() {
  mountShell({ page: "account" });
  mountAccountNav("saved");
  const profile = await requireUser();
  if (!profile) return;
  await load();
}

async function load() {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "true");
  try {
    const rows = await listSavedReels();
    root.setAttribute("aria-busy", "false");
    if (!rows.length) {
      root.innerHTML = `<p class="empty">${escapeHtml(t("noSavedReels"))} <a href="${url("pages/reels.html")}">${escapeHtml(t("reels"))}</a></p>`;
      return;
    }
    root.innerHTML = `
      <div class="saved-reels-grid">
        ${rows.map((reel) => {
          const href = `${url("pages/reel.html")}?id=${encodeURIComponent(reel.id)}`;
          const label = reel.shop?.shop_name || reel.caption || t("reels");
          const image = reel.thumbnailUrl
            ? `<img src="${escapeHtml(reel.thumbnailUrl)}" alt="" loading="lazy">`
            : "";
          return `
            <a class="reel-thumb-card" href="${href}">
              ${image}
              <span class="reel-thumb-label">${escapeHtml(label)}</span>
            </a>
          `;
        }).join("")}
      </div>
    `;
  } catch (error) {
    console.error("Saved reels:", error);
    root.setAttribute("aria-busy", "false");
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), load);
  }
}
