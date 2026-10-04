import { mountAccountNav } from "./accountShell.js";
import { listLiveNow } from "./api/liveApi.js";
import { listMyOrders } from "./api/ordersApi.js";
import { listFollowedShops } from "./api/shopsApi.js";
import { listWishlist } from "./api/wishlistApi.js";
import { authErrorMessage, claimAccountRole, requireUser, roleChangeMessage } from "./auth.js";
import { mountShell, toast } from "./components.js";
import { escapeHtml } from "./html.js";
import { url } from "./paths.js";

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

  const name = profile.full_name?.trim() || "there";
  const cards = [
    ["Orders", `${orders} orders`, url("pages/account/orders.html")],
    ["Wishlist", `${saved} saved products`, url("pages/wishlist.html")],
    ["Following", `${shops} shops`, url("pages/following.html")],
    ["Messages", "Chat with a shop", url("pages/chat.html")],
    ["Live", "Watch shops that are live", url("pages/lives.html")],
    ["Addresses", "Delivery addresses", url("pages/account/addresses.html")],
    ["Profile", "Name, photo, password", url("pages/account/profile.html")],
    ["Vendor studio", "Products, shop, and go live", url("pages/vendor.html")],
    ["Admin", "Vendors, orders, payouts", url("pages/admin.html")],
  ];

  let lives = [];
  try {
    lives = await listLiveNow({ limit: 4 });
  } catch (error) {
    console.error("customer lives:", error);
  }

  const liveCards = lives.map((stream) => {
    const href = `${url("pages/live.html")}?id=${encodeURIComponent(stream.id)}`;
    const shopName = stream.shop?.shop_name || "Shop";
    return `
      <article class="live-card">
        <a class="live-card-media" href="${href}">
          ${stream.thumbnailUrl ? `<img src="${escapeHtml(stream.thumbnailUrl)}" alt="" loading="lazy">` : ""}
          <span class="live-badge is-live">LIVE</span>
        </a>
        <div class="live-card-body">
          <h3><a href="${href}">${escapeHtml(stream.title || "Live")}</a></h3>
          <p class="live-card-meta">${escapeHtml(shopName)}</p>
        </div>
      </article>
    `;
  }).join("");

  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <p>Hello, ${escapeHtml(name)}. This login is <strong>${escapeHtml(profile.role)}</strong>.</p>
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
        <h2>Live now</h2>
        <a href="${url("pages/lives.html")}">All lives</a>
      </div>
      ${liveCards
        ? `<div class="lives-home-row">${liveCards}</div>`
        : `<p class="muted">No shop is live right now. When a vendor presses Go live in the studio, the room shows up here and on the Live page. You can watch without being a vendor.</p>`}
    </section>
    <section class="account-card">
      <h2>Use this same account</h2>
      <p class="muted">Vendor studio and Admin are real pages. Switch this login if you want to open them. A new account can also pick the role on the register page.</p>
      ${profile.role === "vendor" ? "" : `
        <label class="field">
          <span>Shop name</span>
          <input id="claim-shop-name" maxlength="80" placeholder="My shop">
        </label>
        <button class="button button-primary" type="button" id="become-vendor">Use this account as vendor</button>
      `}
      ${profile.role === "admin" ? "" : `
        <button class="button button-primary" type="button" id="become-admin">Use this account as admin</button>
      `}
    </section>
  `;

  root.querySelector("#become-vendor")?.addEventListener("click", async () => {
    const input = root.querySelector("#claim-shop-name");
    const shopName = input instanceof HTMLInputElement ? input.value.trim() : "";
    if (shopName && (shopName.length < 2 || shopName.length > 80)) {
      toast("Shop name must be 2 to 80 characters.", "error");
      return;
    }
    try {
      await claimAccountRole("vendor", shopName);
      toast("This account is a vendor. Opening the studio.", "success");
      window.location.assign(url("pages/vendor.html"));
    } catch (error) {
      console.error("claim vendor:", error);
      toast(roleChangeMessage(error), "error");
    }
  });

  root.querySelector("#become-admin")?.addEventListener("click", async () => {
    try {
      await claimAccountRole("admin");
      toast("This account is an admin. Opening the admin desk.", "success");
      window.location.assign(url("pages/admin.html"));
    } catch (error) {
      console.error("claim admin:", error);
      toast(roleChangeMessage(error), "error");
    }
  });
}
