/**
 * Shared account chrome: sidebar on desktop, tab bar on mobile.
 */

import { signOut } from "./auth.js";
import { openModal, toast } from "./components.js";
import { escapeHtml } from "./html.js";
import { url } from "./paths.js";

/**
 * Injects account navigation into #account-nav.
 * @param {"profile" | "addresses" | "orders" | "wishlist"} active
 */
export function mountAccountNav(active) {
  const root = document.querySelector("#account-nav");
  if (!root) return;

  const links = [
    { id: "profile", href: url("pages/account/profile.html"), label: "Profile" },
    { id: "addresses", href: url("pages/account/addresses.html"), label: "Addresses" },
    { id: "orders", href: url("pages/account/orders.html"), label: "Orders" },
    { id: "wishlist", href: url("pages/wishlist.html"), label: "Wishlist" },
  ];

  root.innerHTML = `
    <nav class="account-tabs" aria-label="Account">
      ${links.map((link) => `
        <a class="${link.id === active ? "is-active" : ""}" href="${link.href}">${escapeHtml(link.label)}</a>
      `).join("")}
      <button class="account-tab-logout" type="button" data-account-logout>Logout</button>
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
