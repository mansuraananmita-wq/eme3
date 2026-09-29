import { mountAccountNav } from "../accountShell.js";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
  validateAddressInput,
} from "../api/addressApi.js";
import { authErrorMessage, requireUser } from "../auth.js";
import { mountShell, openModal, toast } from "../components.js";
import { escapeHtml } from "../html.js";
import { showState } from "../ui-state.js";

const root = document.querySelector("#addresses-root");

/** @type {Array<object>} */
let addresses = [];

boot();

async function boot() {
  const profile = await requireUser();
  if (!profile) return;
  mountShell({ page: "account" });
  mountAccountNav("addresses");
  await load();
}

async function load() {
  if (!root) return;
  root.setAttribute("aria-busy", "true");
  try {
    addresses = await listAddresses();
    render();
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
  }
}

function render() {
  if (!root) return;
  root.setAttribute("aria-busy", "false");

  const list = addresses.length
    ? `<div class="address-list">${addresses.map((row) => cardHtml(row)).join("")}</div>`
    : `<p class="empty">No saved addresses yet. Add one for faster checkout.</p>`;

  root.innerHTML = `
    ${list}
    <section class="account-card">
      <h2 id="form-title">Add address</h2>
      ${formHtml()}
    </section>
  `;

  bindForm(null);
  root.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-edit");
      const row = addresses.find((item) => item.id === id);
      if (!row) return;
      const title = root.querySelector("#form-title");
      if (title) title.textContent = "Edit address";
      const formHost = root.querySelector(".account-card:last-child");
      if (formHost) {
        formHost.innerHTML = `<h2 id="form-title">Edit address</h2>${formHtml(row)}`;
        bindForm(row.id);
        formHost.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  root.querySelectorAll("[data-default]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await setDefaultAddress(button.getAttribute("data-default") || "");
        toast("Default address updated.", "success");
        await load();
      } catch (error) {
        toast(authErrorMessage(error), "error");
      }
    });
  });

  root.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-delete") || "";
      openModal({
        title: "Delete address",
        body: "Remove this delivery address from your account?",
        confirmLabel: "Delete",
        onConfirm: async () => {
          await deleteAddress(id);
          toast("Address deleted.", "success");
          await load();
        },
      });
    });
  });
}

/**
 * @param {object} row
 * @returns {string}
 */
function cardHtml(row) {
  return `
    <article class="address-card">
      <div class="address-card-head">
        <strong>${escapeHtml(row.label)}</strong>
        ${row.is_default ? `<span class="status-badge is-delivered">Default</span>` : ""}
      </div>
      <p>${escapeHtml(row.recipient_name)} · ${escapeHtml(row.phone)}</p>
      <p>${escapeHtml(row.line1)}${row.line2 ? `, ${escapeHtml(row.line2)}` : ""}</p>
      <p class="muted">${escapeHtml(row.city)}, ${escapeHtml(row.district)}${row.postal_code ? ` · ${escapeHtml(row.postal_code)}` : ""}</p>
      <div class="address-actions">
        <button class="button button-ghost" type="button" data-edit="${escapeHtml(row.id)}">Edit</button>
        ${row.is_default ? "" : `<button class="button button-ghost" type="button" data-default="${escapeHtml(row.id)}">Set default</button>`}
        <button class="button button-ghost" type="button" data-delete="${escapeHtml(row.id)}">Delete</button>
      </div>
    </article>
  `;
}

/**
 * @param {object | null} [row]
 * @returns {string}
 */
function formHtml(row = null) {
  return `
    <form class="address-form" id="address-form">
      <label class="field"><span>Label</span>
        <input name="label" maxlength="40" required value="${escapeHtml(row?.label || "Home")}">
      </label>
      <label class="field"><span>Recipient name</span>
        <input name="recipient_name" maxlength="120" required value="${escapeHtml(row?.recipient_name || "")}">
      </label>
      <label class="field"><span>Phone</span>
        <input name="phone" maxlength="20" inputmode="tel" required placeholder="01XXXXXXXXX" value="${escapeHtml(row?.phone || "")}">
      </label>
      <label class="field"><span>Address line 1</span>
        <input name="line1" maxlength="180" required value="${escapeHtml(row?.line1 || "")}">
      </label>
      <label class="field"><span>Address line 2 (optional)</span>
        <input name="line2" maxlength="180" value="${escapeHtml(row?.line2 || "")}">
      </label>
      <label class="field"><span>City / area</span>
        <input name="city" maxlength="80" required value="${escapeHtml(row?.city || "")}">
      </label>
      <label class="field"><span>District</span>
        <input name="district" maxlength="80" required value="${escapeHtml(row?.district || "")}">
      </label>
      <label class="field"><span>Postal code (optional)</span>
        <input name="postal_code" maxlength="20" value="${escapeHtml(row?.postal_code || "")}">
      </label>
      <label class="field-inline">
        <input name="is_default" type="checkbox" ${row?.is_default || !addresses.length ? "checked" : ""}>
        <span>Set as default</span>
      </label>
      <button class="button button-primary" type="submit">${row ? "Save changes" : "Add address"}</button>
      ${row ? `<button class="button button-ghost" type="button" data-cancel-edit>Cancel</button>` : ""}
    </form>
  `;
}

/**
 * @param {string | null} editId
 */
function bindForm(editId) {
  const form = root?.querySelector("#address-form");
  form?.querySelector("[data-cancel-edit]")?.addEventListener("click", () => render());

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const input = {
      label: String(data.get("label") || ""),
      recipient_name: String(data.get("recipient_name") || ""),
      phone: String(data.get("phone") || ""),
      line1: String(data.get("line1") || ""),
      line2: String(data.get("line2") || ""),
      city: String(data.get("city") || ""),
      district: String(data.get("district") || ""),
      postal_code: String(data.get("postal_code") || ""),
      is_default: data.get("is_default") === "on",
    };
    const invalid = validateAddressInput(input);
    if (invalid) {
      toast(invalid, "error");
      return;
    }

    const button = form.querySelector("button[type='submit']");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      if (editId) await updateAddress(editId, input);
      else await createAddress(input);
      toast(editId ? "Address updated." : "Address added.", "success");
      await load();
    } catch (error) {
      toast(authErrorMessage(error), "error");
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });
}
