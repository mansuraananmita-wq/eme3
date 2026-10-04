/**
 * Shared account chrome: sidebar on desktop, tab bar on mobile.
 */

import { signOut } from "./auth.js?v=3";
import { openModal, toast } from "./components.js?v=9";
import { escapeHtml } from "./html.js";
import { url } from "./paths.js?v=4";
import { t } from "./i18n.js?v=9";

/**
 * Injects account navigation into #account-nav.
 * @param {"home" | "profile" | "addresses" | "orders" | "wishlist" | "following" | "transactions"} active
 */
export function mountAccountNav(active) {
  const root = document.querySelector("#account-nav");
  if (!root) return;

  const links = [
    { id: "home", href: url("pages/customer.html"), label: t("account") },
    { id: "profile", href: url("pages/account/profile.html"), label: t("profile") },
    { id: "addresses", href: url("pages/account/addresses.html"), label: t("addresses") },
    { id: "orders", href: url("pages/account/orders.html"), label: t("orders") },
    { id: "transactions", href: url("pages/account/transactions.html"), label: t("transactions") },
    { id: "following", href: url("pages/following.html"), label: t("following") },
    { id: "wishlist", href: url("pages/wishlist.html"), label: t("wishlist") },
  ];

  root.innerHTML = `
    <nav class="account-tabs" aria-label="Account">
      ${links.map((link) => `
        <a class="${link.id === active ? "is-active" : ""}" href="${link.href}">${escapeHtml(link.label)}</a>
      `).join("")}
      <button class="account-tab-logout" type="button" data-account-logout>${escapeHtml(t("logout"))}</button>
    </nav>
  `;

  root.querySelector("[data-account-logout]")?.addEventListener("click", () => {
    openModal({
      title: "Sign out",
      body: "You will need to sign in again to see your cart, wishlist, and orders.",
      confirmLabel: "Sign out",
      onConfirm: async () => {
        await signOut();
        toast("Signed out.", "success");
        window.location.assign(url("index.html"));
      },
    });
  });
}
