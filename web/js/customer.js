import { mountAccountNav } from "./accountShell.js";
import { listLiveNow } from "./api/liveApi.js";
import { listMyOrders } from "./api/ordersApi.js";
import { listFollowedShops } from "./api/shopsApi.js";
import { listWishlist } from "./api/wishlistApi.js";
import { authErrorMessage, claimAccountRole, requireUser, roleChangeMessage } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=16";
import { escapeHtml } from "./html.js";
import { icon } from "./icons.js";
import { t } from "./i18n.js?v=16";
import { url } from "./paths.js?v=4";

const root = document.querySelector("#customer-root");

start();

async function start() {
  mountShell({ page: "account" });
  mountAccountNav("home");
  const profile = await requireUser();
  if (!profile || !(root instanceof HTMLElement)) return;

  let orders = 0;
  let saved = 0;
  let shops = 0;
  try {
    const [orderPage, wishlist, followed] = await Promise.all([
      listMyOrders({ limit: 1 }),
      listWishlist(),
      listFollowedShops(),
    ]);
    orders = orderPage.total;
    saved = wishlist.length;
    shops = followed.length;
  } catch (error) {
    console.error("customer home:", error);
    toast(authErrorMessage(error), "error");
  }

  const name = profile.full_name?.trim() || t("account");
  const roleKey = profile.role === "admin" ? "roleAdmin" : profile.role === "vendor" ? "roleVendor" : "roleCustomer";
  const cards = [
    profile.role === "vendor"
      ? [t("addProduct"), t("vendorStudioHint"), `${url("pages/vendor.html")}#product`]
      : [t("openShop"), t("sellBlurb"), `${url("pages/sell.html")}#sell-apply`],
    [t("orders"), `${orders} ${t("ordersCount")}`, url("pages/account/orders.html")],
    [t("wishlist"), `${saved} ${t("savedProducts")}`, url("pages/wishlist.html")],
    [t("following"), `${shops} ${t("shopsCount")}`, url("pages/following.html")],
    [t("savedReels"), t("savedReelsHint"), url("pages/saved-reels.html")],
    [t("messages"), t("chatWithShop"), url("pages/chat.html")],
    [t("live"), t("watchLiveShops"), url("pages/lives.html")],
    [t("addresses"), t("deliveryAddresses"), url("pages/account/addresses.html")],
    [t("profile"), t("profileHint"), url("pages/account/profile.html")],
    [t("vendorStudio"), t("vendorStudioHint"), url("pages/vendor.html")],
    [t("admin"), t("adminHint"), url("pages/admin.html")],
  ];

  let lives = [];
  try {
    lives = await listLiveNow({ limit: 4 });
  } catch (error) {
    console.error("customer lives:", error);
  }

  const liveCards = lives.map((stream) => {
    const href = `${url("pages/live.html")}?id=${encodeURIComponent(stream.id)}`;
    const shopName = stream.shop?.shop_name || stream.title || "Live";
    const thumb = stream.thumbnailUrl
      ? `<img src="${escapeHtml(stream.thumbnailUrl)}" alt="" loading="lazy">`
      : `<span class="live-thumb-fallback">${escapeHtml(shopName.slice(0, 1))}</span>`;
    return `
      <a class="live-thumb" href="${href}">
        ${thumb}
        <span class="live-thumb-badge">LIVE</span>
        <span class="live-thumb-play" aria-hidden="true">${icon("play")}</span>
        <span class="live-thumb-label">${escapeHtml(shopName)}</span>
      </a>
    `;
  }).join("");

  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <p>${escapeHtml(t("hello"))}, ${escapeHtml(name)}. ${escapeHtml(t("loginIs"))} <strong>${escapeHtml(t(roleKey))}</strong>.</p>
    <div class="hub-grid">
      ${cards.map(([title, detail, href]) => `
        <a class="hub-card" href="${href}">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(detail)}</span>
        </a>
      `).join("")}
    </div>
    <section class="account-card">
      <div class="vendor-orders-head">
        <h2>${escapeHtml(t("liveNowTitle"))}</h2>
        <a href="${url("pages/lives.html")}">${escapeHtml(t("allLives"))}</a>
      </div>
      ${liveCards
        ? `<div class="live-thumb-row">${liveCards}</div>`
        : `<p class="muted">${escapeHtml(t("noLiveHome"))}</p>`}
    </section>
    <section class="account-card">
      <h2>${escapeHtml(t("sameAccount"))}</h2>
      <p class="muted">${escapeHtml(t("sameAccountHint"))}</p>
      ${profile.role === "vendor" ? "" : `
        <label class="field">
          <span>${escapeHtml(t("shopName"))}</span>
          <input id="claim-shop-name" maxlength="80" placeholder="${escapeHtml(t("myShop"))}">
        </label>
        <button class="button button-primary" type="button" id="become-vendor">${escapeHtml(t("useAsVendor"))}</button>
      `}
    </section>
  `;

  root.querySelector("#become-vendor")?.addEventListener("click", async () => {
    const input = root.querySelector("#claim-shop-name");
    const shopName = input instanceof HTMLInputElement ? input.value.trim() : "";
    if (shopName && (shopName.length < 2 || shopName.length > 80)) {
      toast(t("shopNameInvalid"), "error");
      return;
    }
    try {
      await claimAccountRole("vendor", shopName);
      toast(t("becameVendor"), "success");
      window.location.assign(url("pages/vendor.html"));
    } catch (error) {
      console.error("claim vendor:", error);
      toast(roleChangeMessage(error), "error");
    }
  });
}
