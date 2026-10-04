import { mountAccountNav } from "./accountShell.js";
import { listMyOrders } from "./api/ordersApi.js";
import { listFollowedShops } from "./api/shopsApi.js";
import { listWishlist } from "./api/wishlistApi.js";
import { authErrorMessage, requireUser } from "./auth.js";
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
    ["Addresses", "Delivery addresses", url("pages/account/addresses.html")],
    ["Profile", "Name, photo, password", url("pages/account/profile.html")],
  ];
  if (profile.role === "vendor" || profile.role === "admin") {
    cards.push(["Studio", "Your shop, products, and live", url("pages/vendor.html")]);
    cards.push(["Shop orders", "Pack and ship", url("pages/vendor-orders.html")]);
  }
  if (profile.role === "admin") {
    cards.push(["Admin", "Vendors, orders, payouts", url("pages/admin.html")]);
  }
  if (profile.role === "customer") {
    cards.push(["Sell on EME", "Open your own shop", url("pages/sell.html")]);
  }

  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <p>Hello, ${escapeHtml(name)}.</p>
    <div class="hub-grid">
      ${cards.map(([title, detail, href]) => `
        <a class="hub-card" href="${href}">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(detail)}</span>
        </a>
      `).join("")}
    </div>
  `;
}
