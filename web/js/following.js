import { mountAccountNav } from "./accountShell.js";
import { listFollowedShops } from "./api/shopsApi.js";
import { unfollowShop } from "./api/reelsApi.js";
import { authErrorMessage, requireUser } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=16";
import { escapeHtml } from "./html.js";
import { url } from "./paths.js?v=4";
import { shopHref } from "./shopView.js";
import { showState } from "./ui-state.js";

const root = document.querySelector("#following-root");

start();

async function start() {
  mountShell({ page: "account" });
  mountAccountNav("following");
  const profile = await requireUser();
  if (!profile) return;
  await load();
}

async function load() {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "true");
  try {
    const rows = await listFollowedShops();
    root.setAttribute("aria-busy", "false");
    if (!rows.length) {
      root.innerHTML = `<p class="empty">You are not following a shop yet. <a href="${url("pages/shops.html")}">Browse stores</a></p>`;
      return;
    }
    root.innerHTML = `
      <div class="admin-list">
        ${rows.map((shop) => `
          <article class="order-card">
            <div class="address-card-head">
              <strong>${shop.slug ? `<a class="title-link" href="${shopHref(shop.slug)}">${escapeHtml(shop.shopName)}</a>` : escapeHtml(shop.shopName)}</strong>
              <span class="muted">${escapeHtml(String(shop.followers))} followers</span>
            </div>
            <div class="order-actions">
              ${shop.slug ? `<a class="button button-primary" href="${shopHref(shop.slug)}">Visit store</a>` : ""}
              <button class="button button-ghost" type="button" data-unfollow="${escapeHtml(shop.vendorId)}">Unfollow</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
    root.querySelectorAll("[data-unfollow]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-unfollow") || "";
        if (!(button instanceof HTMLButtonElement) || !id) return;
        button.disabled = true;
        try {
          await unfollowShop(id);
          toast("Unfollowed.", "success");
          await load();
        } catch (error) {
          console.error("unfollow:", error);
          toast(authErrorMessage(error), "error");
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    console.error("following:", error);
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, message, () => load());
  }
}
