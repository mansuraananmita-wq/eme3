import {
  applyAsVendor,
  getCommissionPercent,
  getMyShopApplication,
  slugifyShopName,
} from "./api/shopsApi.js";
import { authErrorMessage, getCurrentProfile } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js";
import { escapeHtml } from "./html.js";
import { loginRedirect, url } from "./paths.js";

mountShell({ page: "sell" });

const applyRoot = document.querySelector("#sell-apply");
const commissionRoot = document.querySelector("#commission-note");

boot();

async function boot() {
  try {
    const percent = await getCommissionPercent();
    if (commissionRoot) {
      commissionRoot.textContent = percent != null
        ? `Platform commission is currently ${percent}% of each sale (from platform settings).`
        : "Commission is set by the platform and shared after your shop is approved.";
    }
  } catch {
    if (commissionRoot) {
      commissionRoot.textContent = "Commission is set by the platform and shared after your shop is approved.";
    }
  }

  await renderApply();
}

async function renderApply() {
  if (!applyRoot) return;

  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      applyRoot.innerHTML = `
        <p>Create a free customer account, then apply to open your store.</p>
        <a class="button button-primary" href="${loginRedirect()}">Sign in to apply</a>
      `;
      return;
    }

    const existing = await getMyShopApplication();
    if (existing) {
      applyRoot.innerHTML = `
        <div class="notice">
          <p><strong>${escapeHtml(existing.shop_name)}</strong> · status: ${escapeHtml(existing.status)}</p>
          <p class="muted">An admin approves pending shops. You cannot change status from the browser.</p>
          <a class="button button-primary" href="${url("pages/vendor.html")}">Open studio</a>
          ${existing.status === "approved"
            ? `<a class="button button-ghost" href="${url("pages/shop.html")}?slug=${encodeURIComponent(existing.slug)}">View your storefront</a>`
            : ""}
        </div>
      `;
      return;
    }

    applyRoot.innerHTML = `
      <form id="vendor-apply-form" class="auth-card sell-form" novalidate>
        <h2>Apply to sell</h2>
        <p class="muted">Your application starts as pending. RLS only allows you to create your own pending shop.</p>
        <label class="field">
          <span>Shop name</span>
          <input name="shop_name" maxlength="80" required>
          <small class="field-error" id="name-error"></small>
        </label>
        <label class="field">
          <span>Shop slug</span>
          <input name="slug" maxlength="80" required pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$">
          <small class="muted">Lowercase letters, numbers, and hyphens.</small>
          <small class="field-error" id="slug-error"></small>
        </label>
        <label class="field">
          <span>Short description</span>
          <textarea name="description" rows="3" maxlength="500"></textarea>
        </label>
        <label class="field">
          <span>Logo URL (optional)</span>
          <input name="logo_url" type="url" placeholder="https://">
        </label>
        <label class="field">
          <span>Banner URL (optional)</span>
          <input name="banner_url" type="url" placeholder="https://">
        </label>
        <button class="button button-primary" type="submit">Submit application</button>
      </form>
    `;

    const form = applyRoot.querySelector("#vendor-apply-form");
    const nameInput = form?.querySelector("[name='shop_name']");
    const slugInput = form?.querySelector("[name='slug']");

    nameInput?.addEventListener("input", () => {
      if (slugInput instanceof HTMLInputElement && !slugInput.dataset.touched) {
        slugInput.value = slugifyShopName(String(nameInput.value || ""));
      }
    });
    slugInput?.addEventListener("input", () => {
      if (slugInput instanceof HTMLInputElement) slugInput.dataset.touched = "1";
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const shopName = String(data.get("shop_name") || "").trim();
      const slug = String(data.get("slug") || "").trim();
      const nameError = applyRoot.querySelector("#name-error");
      const slugError = applyRoot.querySelector("#slug-error");
      if (nameError) nameError.textContent = "";
      if (slugError) slugError.textContent = "";

      let valid = true;
      if (shopName.length < 2 || shopName.length > 80) {
        if (nameError) nameError.textContent = "Shop name must be 2 to 80 characters.";
        valid = false;
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        if (slugError) slugError.textContent = "Use a lowercase slug like my-shop-name.";
        valid = false;
      }
      if (!valid) return;

      const button = form.querySelector("button[type='submit']");
      if (button instanceof HTMLButtonElement) button.disabled = true;

      try {
        await applyAsVendor({
          shop_name: shopName,
          slug,
          description: String(data.get("description") || ""),
          logo_url: String(data.get("logo_url") || ""),
          banner_url: String(data.get("banner_url") || ""),
        });
        toast("Application submitted. Waiting for admin approval.", "success");
        await renderApply();
      } catch (error) {
        toast(authErrorMessage(error), "error");
        if (button instanceof HTMLButtonElement) button.disabled = false;
      }
    });
  } catch (error) {
    toast(authErrorMessage(error), "error");
    applyRoot.innerHTML = `<p class="empty">${escapeHtml(authErrorMessage(error))}</p>`;
  }
}
