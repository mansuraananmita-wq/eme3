import {
  adminPanelAccess,
  adminSnapshot,
  archiveProduct,
  createPayout,
  listAdminCategories,
  listAllOrders,
  listApprovedShops,
  listDisputes,
  listModerationProducts,
  listModerationReels,
  listPayouts,
  listPlatformSettings,
  listProfiles,
  listVendorApplications,
  refundOrder,
  removeReel,
  saveCategory,
  savePlatformSetting,
  setDisputeStatus,
  setPayoutStatus,
  setUserRole,
  setVendorStatus,
} from "./api/adminApi.js?v=7";
import { slugifyShopName } from "./api/shopsApi.js";
import { authErrorMessage, claimAccountRole, getCurrentProfile, roleChangeMessage } from "./auth.js?v=3";
import { mountShell, openModal, toast } from "./components.js?v=11";
import { formatMoney } from "./format.js";
import { escapeHtml } from "./html.js";
import { t } from "./i18n.js?v=11";
import { loginRedirect, url } from "./paths.js?v=4";
import { showState } from "./ui-state.js";

mountShell({ page: "account" });

const root = document.querySelector("#admin-root");
/** @type {"dashboard" | "vendors" | "moderation" | "orders" | "people" | "categories" | "settings" | "disputes" | "payouts"} */
let tab = "dashboard";

const TABS = [
  ["dashboard", "Dashboard"],
  ["vendors", "Vendors"],
  ["moderation", "Moderation"],
  ["orders", "Orders"],
  ["disputes", "Disputes"],
  ["payouts", "Payouts"],
  ["people", "People"],
  ["categories", "Catalog"],
  ["settings", "Settings"],
];

/** @type {"all" | "pending" | "approved" | "suspended"} */
let vendorFilter = "pending";

let unlocked = false;

document.querySelectorAll("#admin-tabs [data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    selectTab(button.getAttribute("data-tab") || "dashboard");
  });
});

boot();

async function boot() {
  if (!(root instanceof HTMLElement)) return;

  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch (error) {
    console.error("Admin profile:", error);
    showGate(authErrorMessage(error), url("index.html"), t("backHome"));
    return;
  }

  if (!profile) {
    showGate(
      t("adminSignIn"),
      loginRedirect(),
      t("signIn"),
    );
    return;
  }

  if (profile.role !== "admin") {
    showGate(
      t("adminNotYet"),
      url("pages/customer.html"),
      t("myAccount"),
      "admin",
    );
    return;
  }

  try {
    const allowed = await adminPanelAccess();
    if (!allowed) {
      showGate(t("adminNotYet"), url("index.html"), t("backHome"));
      return;
    }
  } catch (error) {
    console.error("Admin access:", error);
    const missingRpc = error && typeof error === "object" && "code" in error && error.code === "PGRST202";
    if (!missingRpc) {
      showGate(authErrorMessage(error), url("index.html"), t("backHome"));
      return;
    }
  }

  unlocked = true;
  await render();
}

/**
 * Stays on the admin page. A timed redirect was sending people to login
 * before the Vendors, Moderation, and Orders tabs could render.
 * @param {string} message
 * @param {string} href
 * @param {string} label
 */
/**
 * @param {string} message
 * @param {string} href
 * @param {string} label
 * @param {"admin" | "vendor" | ""} [claimRole]
 */
function showGate(message, href, label, claimRole = "") {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <div class="state-panel">
      <p>${escapeHtml(t("admin"))}</p>
      <p class="muted">${escapeHtml(message)}</p>
      ${claimRole ? `<p><button class="button button-primary" type="button" id="claim-role">${escapeHtml(t("useAsAdmin"))}</button></p>` : ""}
      <p><a class="button button-ghost" href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>
    </div>
  `;
  root.querySelector("#claim-role")?.addEventListener("click", async () => {
    try {
      await claimAccountRole("admin");
      toast(t("becameAdmin"), "success");
      window.location.reload();
    } catch (error) {
      console.error("claim admin:", error);
      toast(roleChangeMessage(error), "error");
    }
  });
}

async function render() {
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute("aria-busy", "true");
  root.innerHTML = `<div id="admin-panel" aria-busy="true"><div class="skeleton skeleton-card"></div></div>`;

  const panel = root.querySelector("#admin-panel");
  if (!(panel instanceof HTMLElement)) return;

  try {
    if (tab === "dashboard") await renderDashboard(panel);
    else if (tab === "vendors") await renderVendors(panel);
    else if (tab === "moderation") await renderModeration(panel);
    else if (tab === "orders") await renderOrders(panel);
    else if (tab === "people") await renderPeople(panel);
    else if (tab === "categories") await renderCategories(panel);
    else if (tab === "settings") await renderSettings(panel);
    else if (tab === "disputes") await renderDisputes(panel);
    else await renderPayouts(panel);
  } catch (error) {
    console.error("Admin tab:", error);
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(panel, message, () => render());
  }
}

/**
 * @param {HTMLElement} panel
 */
async function renderDashboard(panel) {
  const snap = await adminSnapshot();
  panel.setAttribute("aria-busy", "false");
  const cards = [
    ["pendingVendors", t("shopsWaiting"), t("shopsWaitingHint"), "vendors"],
    ["approvedVendors", t("approvedShops"), t("approvedShopsHint"), "vendors"],
    ["liveNow", t("liveNowTitle"), t("liveNowHint"), "moderation"],
    ["products", t("activeProducts"), t("activeProductsHint"), "moderation"],
    ["reels", t("reels"), t("reelsHint"), "moderation"],
    ["orders", t("orders"), t("ordersHint"), "orders"],
    ["openDisputes", t("openDisputes"), t("openDisputesHint"), "disputes"],
    ["suspendedVendors", t("suspendedShops"), t("suspendedShopsHint"), "vendors"],
  ];
  panel.innerHTML = `
    <p class="muted">${escapeHtml(t("dashIntro"))}</p>
    <div class="admin-stats">
      ${cards.map(([key, title, hint, next]) => `
        <button class="admin-stat" type="button" data-go="${next}" data-vendor-filter="${key === "pendingVendors" ? "pending" : key === "approvedVendors" ? "approved" : key === "suspendedVendors" ? "suspended" : ""}">
          <strong>${escapeHtml(String(snap[key] ?? 0))}</strong>
          <span>${escapeHtml(title)}</span>
          <small>${escapeHtml(hint)}</small>
        </button>
      `).join("")}
    </div>
  `;
  panel.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("data-go") || "dashboard";
      const filter = button.getAttribute("data-vendor-filter") || "";
      if (filter === "pending" || filter === "approved" || filter === "suspended") vendorFilter = filter;
      selectTab(next);
    });
  });
}

/**
 * @param {string} next
 */
function selectTab(next) {
  if (!TABS.some(([id]) => id === next)) return;
  tab = /** @type {typeof tab} */ (next);
  document.querySelectorAll("#admin-tabs [data-tab]").forEach((item) => {
    const on = item.getAttribute("data-tab") === tab;
    item.classList.toggle("is-active", on);
    item.setAttribute("aria-selected", on ? "true" : "false");
  });
  if (unlocked) render();
}

/**
 * @param {HTMLElement} panel
 */
async function renderVendors(panel) {
  const rows = (await listVendorApplications()).filter((row) => vendorFilter === "all" || row.status === vendorFilter);
  panel.setAttribute("aria-busy", "false");
  const filters = ["pending", "approved", "suspended", "all"];
  panel.innerHTML = `
    <p class="muted">${escapeHtml(t("vendorFilterHint"))}</p>
    <div class="admin-tabs" role="tablist">
      ${filters.map((id) => `
        <button type="button" data-vendor-filter="${id}" class="${vendorFilter === id ? "is-active" : ""}">${escapeHtml(t(id))}</button>
      `).join("")}
    </div>
    <div class="admin-list">
      ${rows.length ? rows.map((row) => `
        <article class="order-card">
          <div class="address-card-head">
            <strong>${escapeHtml(row.shopName)}</strong>
            <span class="status-badge is-${escapeHtml(row.status)}">${escapeHtml(t(row.status))}</span>
          </div>
          <p class="muted">${escapeHtml(row.applicant)} · ${escapeHtml(formatWhen(row.createdAt))}</p>
          <div class="order-actions">
            ${vendorActionButtons(row)}
            <a class="button button-ghost" href="${url("pages/shop.html")}?slug=${encodeURIComponent(row.slug)}">${escapeHtml(t("openShop"))}</a>
          </div>
        </article>
      `).join("") : `<p class="empty">${escapeHtml(t("noShopsIn"))}</p>`}
    </div>
  `;

  panel.querySelectorAll("[data-vendor-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("data-vendor-filter") || "pending";
      if (next === "all" || next === "pending" || next === "approved" || next === "suspended") {
        vendorFilter = next;
      }
      render();
    });
  });

  panel.querySelectorAll("[data-vendor]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-vendor") || "";
      const status = button.getAttribute("data-status") || "";
      const label = button.getAttribute("data-label") || status;
      if (!id || (status !== "approved" && status !== "suspended" && status !== "pending")) return;
      openModal({
        title: label === "Reject" ? "Reject shop" : `${label} shop`,
        body: label === "Reject"
          ? "Set this shop to suspended? There is no rejected status."
          : `Set this shop to ${status}?`,
        confirmLabel: label === "Reject" ? "Reject" : status,
        onConfirm: async () => {
          try {
            await setVendorStatus(id, status);
            toast(`Shop set to ${status}.`, "success");
            await render();
          } catch (error) {
            console.error("setVendorStatus:", error);
            toast(authErrorMessage(error), "error");
          }
        },
      });
    });
  });
}

/**
 * Approve only while the shop is not already approved.
 * Suspend only while it is approved. Reject only while it is pending.
 * @param {{ id: string, status: string }} row
 * @returns {string}
 */
function vendorActionButtons(row) {
  const id = escapeHtml(row.id);
  if (row.status === "pending") {
    return `
      <button class="button button-primary" type="button" data-vendor="${id}" data-status="approved">${escapeHtml(t("approve"))}</button>
      <button class="button button-ghost" type="button" data-vendor="${id}" data-status="suspended" data-label="Reject">${escapeHtml(t("reject"))}</button>
    `;
  }
  if (row.status === "approved") {
    return `<button class="button button-ghost" type="button" data-vendor="${id}" data-status="suspended">${escapeHtml(t("suspend"))}</button>`;
  }
  return `<button class="button button-primary" type="button" data-vendor="${id}" data-status="approved" data-label="Restore">${escapeHtml(t("restore"))}</button>`;
}

/**
 * @param {HTMLElement} panel
 */
async function renderModeration(panel) {
  const [reels, products] = await Promise.all([listModerationReels(), listModerationProducts()]);
  panel.setAttribute("aria-busy", "false");
  panel.innerHTML = `
    <h2>Reels</h2>
    <div class="admin-list">
      ${reels.length ? reels.map((reel) => `
        <article class="order-card">
          <div class="address-card-head">
            <strong>${escapeHtml(reel.caption)}</strong>
            <span class="status-badge is-${escapeHtml(reel.status)}">${escapeHtml(reel.status)}</span>
          </div>
          <p class="muted">${escapeHtml(reel.shopName)} · ${escapeHtml(formatWhen(reel.createdAt))}</p>
          ${reel.status === "removed" ? "" : `
            <div class="order-actions">
              <button class="button button-ghost" type="button" data-remove-reel="${escapeHtml(reel.id)}">Remove</button>
            </div>
          `}
        </article>
      `).join("") : `<p class="empty">No reels.</p>`}
    </div>
    <h2>Products</h2>
    <div class="admin-list">
      ${products.length ? products.map((product) => `
        <article class="order-card">
          <div class="address-card-head">
            <strong>${escapeHtml(product.title)}</strong>
            <span class="status-badge is-${escapeHtml(product.status)}">${escapeHtml(product.status)}</span>
          </div>
          <p class="muted">${escapeHtml(product.shopName)} · ${escapeHtml(formatWhen(product.createdAt))}</p>
          ${product.status === "archived" ? "" : `
            <div class="order-actions">
              <button class="button button-ghost" type="button" data-archive-product="${escapeHtml(product.id)}">Remove</button>
            </div>
          `}
        </article>
      `).join("") : `<p class="empty">No products.</p>`}
    </div>
  `;

  panel.querySelectorAll("[data-remove-reel]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-remove-reel") || "";
      openModal({
        title: "Remove reel",
        body: "Set this reel to removed? It stays in the database and leaves the public feed.",
        confirmLabel: "Remove",
        onConfirm: async () => {
          try {
            await removeReel(id);
            toast("Reel removed.", "success");
            await render();
          } catch (error) {
            console.error("removeReel:", error);
            toast(authErrorMessage(error), "error");
          }
        },
      });
    });
  });

  panel.querySelectorAll("[data-archive-product]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-archive-product") || "";
      openModal({
        title: "Remove product",
        body: "Set this product to archived? It stays in the database and leaves the catalog.",
        confirmLabel: "Remove",
        onConfirm: async () => {
          try {
            await archiveProduct(id);
            toast("Product archived.", "success");
            await render();
          } catch (error) {
            console.error("archiveProduct:", error);
            toast(authErrorMessage(error), "error");
          }
        },
      });
    });
  });
}

/**
 * @param {HTMLElement} panel
 */
async function renderOrders(panel) {
  const rows = await listAllOrders();
  panel.setAttribute("aria-busy", "false");
  if (!rows.length) {
    panel.innerHTML = `<p class="empty">No orders yet.</p>`;
    return;
  }

  panel.innerHTML = `
    <div class="admin-list">
      ${rows.map((order) => `
        <article class="order-card">
          <div class="address-card-head">
            <a class="title-link" href="${url("pages/account/order.html")}?id=${encodeURIComponent(order.id)}">
              Order ${escapeHtml(order.id.slice(0, 8))}
            </a>
            <span class="status-badge is-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <div class="order-meta">
            <span>${escapeHtml(order.customer)}</span>
            <span>${escapeHtml(formatMoney(order.total, order.currency))}</span>
            <span>Payment ${escapeHtml(order.paymentStatus || "")}</span>
            <span>${escapeHtml(formatWhen(order.createdAt))}</span>
          </div>
          ${order.status === "delivered" ? `
            <div class="order-actions">
              <button class="button button-ghost" type="button" data-refund="${escapeHtml(order.id)}">Refund</button>
            </div>
          ` : ""}
        </article>
      `).join("")}
    </div>
  `;

  panel.querySelectorAll("[data-refund]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-refund") || "";
      openModal({
        title: "Refund order",
        body: "Mark this delivered order and its cash payment as refunded? Stock is not restored.",
        confirmLabel: "Refund",
        onConfirm: async () => {
          try {
            await refundOrder(id, "Refunded from the admin panel.");
            toast("Order refunded.", "success");
            await render();
          } catch (error) {
            console.error("refundOrder:", error);
            toast(authErrorMessage(error), "error");
          }
        },
      });
    });
  });
}

/**
 * @param {HTMLElement} panel
 */
async function renderPeople(panel) {
  const rows = await listProfiles();
  panel.setAttribute("aria-busy", "false");
  if (!rows.length) {
    panel.innerHTML = `<p class="empty">No profiles yet.</p>`;
    return;
  }

  panel.innerHTML = `
    <p class="muted">Setting someone to vendor does not create a shop. They still apply on Sell. The last admin cannot be demoted.</p>
    <div class="admin-list">
      ${rows.map((row) => `
        <article class="order-card">
          <div class="address-card-head">
            <strong>${escapeHtml(row.fullName)}</strong>
            <span class="status-badge">${escapeHtml(row.role)}</span>
          </div>
          <p class="muted">${escapeHtml(row.id)} · ${escapeHtml(formatWhen(row.createdAt))}</p>
          <form class="order-actions" data-role-form="${escapeHtml(row.id)}">
            <label class="field">
              <span class="sr-only">Role</span>
              <select name="role">
                ${["customer", "vendor", "admin"].map((role) => `
                  <option value="${role}" ${row.role === role ? "selected" : ""}>${role}</option>
                `).join("")}
              </select>
            </label>
            <button class="button button-primary" type="submit">Save role</button>
          </form>
        </article>
      `).join("")}
    </div>
  `;

  panel.querySelectorAll("[data-role-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!(form instanceof HTMLFormElement)) return;
      const userId = form.getAttribute("data-role-form") || "";
      const role = String(new FormData(form).get("role") || "");
      const person = rows.find((row) => row.id === userId);
      openModal({
        title: "Change role",
        body: `Set ${person?.fullName || "this user"} to ${role}?`,
        confirmLabel: "Save",
        onConfirm: async () => {
          try {
            await setUserRole(userId, role);
            toast("Role saved.", "success");
            await render();
          } catch (error) {
            console.error("setUserRole:", error);
            toast(authErrorMessage(error), "error");
          }
        },
      });
    });
  });
}

/**
 * @param {HTMLElement} panel
 */
async function renderCategories(panel) {
  const rows = await listAdminCategories();
  panel.setAttribute("aria-busy", "false");
  const parentOptions = (selected) => `
    <option value="">No parent</option>
    ${rows.map((row) => `
      <option value="${escapeHtml(row.id)}" ${selected === row.id ? "selected" : ""}>${escapeHtml(row.name)}</option>
    `).join("")}
  `;

  panel.innerHTML = `
    <form class="account-card" id="category-form">
      <h2>Add category</h2>
      <input type="hidden" name="id" value="">
      <label class="field"><span>Name</span><input name="name" required maxlength="80"></label>
      <label class="field"><span>Slug</span><input name="slug" required maxlength="80" pattern="[a-z0-9]+(?:-[a-z0-9]+)*"></label>
      <label class="field"><span>Parent</span><select name="parent_id">${parentOptions("")}</select></label>
      <label class="field"><span>Sort order</span><input name="sort_order" type="number" step="1" value="0"></label>
      <label class="field"><span>Image URL</span><input name="image_url" type="url" placeholder="Optional"></label>
      <label class="field"><span><input name="is_active" type="checkbox" checked> Active</span></label>
      <div class="order-actions">
        <button class="button button-primary" type="submit">Save category</button>
        <button class="button button-ghost" type="button" data-category-reset>Clear</button>
      </div>
    </form>
    <div class="admin-list">
      ${rows.length ? rows.map((row) => {
        const parent = rows.find((item) => item.id === row.parent_id);
        return `
          <article class="order-card">
            <div class="address-card-head">
              <strong>${escapeHtml(row.name)}</strong>
              <span class="status-badge">${row.is_active ? "active" : "hidden"}</span>
            </div>
            <p class="muted">${escapeHtml(row.slug)}${parent ? ` · under ${escapeHtml(parent.name)}` : ""}</p>
            <div class="order-actions">
              <button class="button button-ghost" type="button" data-edit-category="${escapeHtml(row.id)}">Edit</button>
            </div>
          </article>
        `;
      }).join("") : `<p class="empty">No categories yet.</p>`}
    </div>
  `;

  const form = panel.querySelector("#category-form");
  if (!(form instanceof HTMLFormElement)) return;
  const nameInput = form.elements.namedItem("name");
  const slugInput = form.elements.namedItem("slug");
  if (nameInput instanceof HTMLInputElement && slugInput instanceof HTMLInputElement) {
    nameInput.addEventListener("input", () => {
      if (slugInput.dataset.touched === "1") return;
      slugInput.value = slugifyShopName(nameInput.value);
    });
    slugInput.addEventListener("input", () => {
      slugInput.dataset.touched = "1";
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector("button[type='submit']");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await saveCategory({
        id: String(data.get("id") || "") || undefined,
        parentId: String(data.get("parent_id") || "") || null,
        name: String(data.get("name") || ""),
        slug: String(data.get("slug") || ""),
        imageUrl: String(data.get("image_url") || ""),
        sortOrder: Number(data.get("sort_order") || 0),
        isActive: data.get("is_active") === "on",
      });
      toast("Category saved.", "success");
      await render();
    } catch (error) {
      console.error("saveCategory:", error);
      toast(authErrorMessage(error), "error");
    } finally {
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });

  panel.querySelector("[data-category-reset]")?.addEventListener("click", () => {
    form.reset();
    const idInput = form.elements.namedItem("id");
    if (idInput instanceof HTMLInputElement) idInput.value = "";
    const heading = form.querySelector("h2");
    if (heading) heading.textContent = "Add category";
    if (slugInput instanceof HTMLInputElement) delete slugInput.dataset.touched;
  });

  panel.querySelectorAll("[data-edit-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((item) => item.id === button.getAttribute("data-edit-category"));
      if (!row) return;
      const idInput = form.elements.namedItem("id");
      const parentInput = form.elements.namedItem("parent_id");
      const sortInput = form.elements.namedItem("sort_order");
      const imageInput = form.elements.namedItem("image_url");
      const activeInput = form.elements.namedItem("is_active");
      if (idInput instanceof HTMLInputElement) idInput.value = row.id;
      if (nameInput instanceof HTMLInputElement) nameInput.value = row.name;
      if (slugInput instanceof HTMLInputElement) {
        slugInput.value = row.slug;
        slugInput.dataset.touched = "1";
      }
      if (parentInput instanceof HTMLSelectElement) parentInput.value = row.parent_id || "";
      if (sortInput instanceof HTMLInputElement) sortInput.value = String(row.sort_order ?? 0);
      if (imageInput instanceof HTMLInputElement) imageInput.value = row.image_url || "";
      if (activeInput instanceof HTMLInputElement) activeInput.checked = row.is_active !== false;
      const heading = form.querySelector("h2");
      if (heading) heading.textContent = "Edit category";
      form.scrollIntoView({ block: "nearest" });
    });
  });
}

/**
 * @param {HTMLElement} panel
 */
async function renderSettings(panel) {
  const rows = await listPlatformSettings();
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const commission = byKey.commission_rate && typeof byKey.commission_rate === "object"
    ? byKey.commission_rate
    : {};
  const shipping = byKey.default_shipping_fee && typeof byKey.default_shipping_fee === "object"
    ? byKey.default_shipping_fee
    : {};
  const currency = typeof byKey.default_currency === "string" ? byKey.default_currency : "BDT";
  panel.setAttribute("aria-busy", "false");

  panel.innerHTML = `
    <form class="account-card" id="settings-form">
      <p class="muted">Checkout still charges 60 BDT in Dhaka and 120 BDT outside. That rule lives in place_order, not in this shipping amount. Commission is shown on the Sell page.</p>
      <label class="field"><span>Commission percent</span><input name="commission" type="number" min="0" max="100" step="0.01" required value="${escapeHtml(String(commission.percent ?? ""))}"></label>
      <label class="field"><span>Stored default shipping (BDT)</span><input name="shipping" type="number" min="0" step="0.01" required value="${escapeHtml(String(shipping.amount ?? ""))}"></label>
      <label class="field"><span>Default currency</span><input name="currency" required maxlength="3" minlength="3" pattern="[A-Z]{3}" value="${escapeHtml(currency)}"></label>
      <button class="button button-primary" type="submit">Save settings</button>
    </form>
  `;

  const form = panel.querySelector("#settings-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const percent = Number(data.get("commission"));
    const amount = Number(data.get("shipping"));
    const nextCurrency = String(data.get("currency") || "").trim().toUpperCase();
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast("Commission must be between 0 and 100.", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast("Shipping amount must be zero or more.", "error");
      return;
    }
    if (!/^[A-Z]{3}$/.test(nextCurrency)) {
      toast("Currency must be three letters.", "error");
      return;
    }
    const button = form.querySelector("button[type='submit']");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await savePlatformSetting("commission_rate", { percent });
      await savePlatformSetting("default_shipping_fee", { amount, currency: "BDT" });
      await savePlatformSetting("default_currency", nextCurrency);
      toast("Settings saved.", "success");
      await render();
    } catch (error) {
      console.error("savePlatformSetting:", error);
      toast(authErrorMessage(error), "error");
    } finally {
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });
}

/**
 * @param {HTMLElement} panel
 */
async function renderDisputes(panel) {
  const rows = await listDisputes();
  panel.setAttribute("aria-busy", "false");
  if (!rows.length) {
    panel.innerHTML = `<p class="empty">No disputes yet. A customer can open one after delivery.</p>`;
    return;
  }

  panel.innerHTML = `
    <p class="muted">Saving a dispute does not move money. Refund a delivered order from the Orders tab.</p>
    <div class="admin-list">
      ${rows.map((row) => `
        <article class="order-card">
          <div class="address-card-head">
            <a class="title-link" href="${url("pages/account/order.html")}?id=${encodeURIComponent(row.orderId)}">Order ${escapeHtml(row.orderId.slice(0, 8))}</a>
            <span class="status-badge is-${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
          </div>
          <p>${escapeHtml(row.reason)}</p>
          <p class="muted">${escapeHtml(row.openedBy)} · ${escapeHtml(formatWhen(row.createdAt))}</p>
          <form data-dispute="${escapeHtml(row.id)}">
            <label class="field">
              <span>Status</span>
              <select name="status">
                ${["open", "investigating", "resolved", "rejected"].map((status) => `
                  <option value="${status}" ${row.status === status ? "selected" : ""}>${status}</option>
                `).join("")}
              </select>
            </label>
            <label class="field">
              <span>Resolution note</span>
              <textarea name="note" maxlength="2000">${escapeHtml(row.resolutionNote)}</textarea>
            </label>
            <button class="button button-primary" type="submit">Save dispute</button>
          </form>
        </article>
      `).join("")}
    </div>
  `;

  panel.querySelectorAll("[data-dispute]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!(form instanceof HTMLFormElement)) return;
      const id = form.getAttribute("data-dispute") || "";
      const data = new FormData(form);
      const button = form.querySelector("button[type='submit']");
      if (button instanceof HTMLButtonElement) button.disabled = true;
      try {
        await setDisputeStatus(id, String(data.get("status") || ""), String(data.get("note") || ""));
        toast("Dispute saved.", "success");
        await render();
      } catch (error) {
        console.error("setDisputeStatus:", error);
        toast(authErrorMessage(error), "error");
      } finally {
        if (button instanceof HTMLButtonElement) button.disabled = false;
      }
    });
  });
}

/**
 * @param {HTMLElement} panel
 */
async function renderPayouts(panel) {
  const [shops, rows] = await Promise.all([listApprovedShops(), listPayouts()]);
  panel.setAttribute("aria-busy", "false");
  panel.innerHTML = `
    <form class="account-card" id="payout-form">
      <h2>New payout</h2>
      <label class="field">
        <span>Shop</span>
        <select name="vendor_id" required>
          <option value="">Choose</option>
          ${shops.map((shop) => `<option value="${escapeHtml(shop.id)}">${escapeHtml(shop.shopName)}</option>`).join("")}
        </select>
      </label>
      <label class="field"><span>Amount (BDT)</span><input name="amount" type="number" min="0" step="0.01" required></label>
      <label class="field"><span>Period start</span><input name="period_start" type="date" required></label>
      <label class="field"><span>Period end</span><input name="period_end" type="date" required></label>
      <label class="field"><span>Reference</span><input name="reference" maxlength="120" placeholder="Optional"></label>
      <button class="button button-primary" type="submit">Create payout</button>
    </form>
    <div class="admin-list">
      ${rows.length ? rows.map((row) => `
        <article class="order-card">
          <div class="address-card-head">
            <strong>${escapeHtml(row.shopName)}</strong>
            <span class="status-badge is-${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
          </div>
          <p>${escapeHtml(formatMoney(row.amount, row.currency))} · ${escapeHtml(row.periodStart)} – ${escapeHtml(row.periodEnd)}</p>
          <form data-payout="${escapeHtml(row.id)}">
            <label class="field"><span>Status</span>
              <select name="status">
                ${["pending", "paid", "failed"].map((status) => `
                  <option value="${status}" ${row.status === status ? "selected" : ""}>${status}</option>
                `).join("")}
              </select>
            </label>
            <label class="field"><span>Reference</span><input name="reference" maxlength="120" value="${escapeHtml(row.reference)}"></label>
            <button class="button button-primary" type="submit">Update payout</button>
          </form>
        </article>
      `).join("") : `<p class="empty">No payouts yet.</p>`}
    </div>
  `;

  panel.querySelector("#payout-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const button = form.querySelector("button[type='submit']");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await createPayout({
        vendorId: String(data.get("vendor_id") || ""),
        amount: Number(data.get("amount")),
        periodStart: String(data.get("period_start") || ""),
        periodEnd: String(data.get("period_end") || ""),
        reference: String(data.get("reference") || ""),
      });
      toast("Payout created.", "success");
      await render();
    } catch (error) {
      console.error("createPayout:", error);
      toast(authErrorMessage(error), "error");
    } finally {
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });

  panel.querySelectorAll("[data-payout]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!(form instanceof HTMLFormElement)) return;
      const id = form.getAttribute("data-payout") || "";
      const data = new FormData(form);
      const button = form.querySelector("button[type='submit']");
      if (button instanceof HTMLButtonElement) button.disabled = true;
      try {
        await setPayoutStatus(id, String(data.get("status") || ""), String(data.get("reference") || ""));
        toast("Payout updated.", "success");
        await render();
      } catch (error) {
        console.error("setPayoutStatus:", error);
        toast(authErrorMessage(error), "error");
      } finally {
        if (button instanceof HTMLButtonElement) button.disabled = false;
      }
    });
  });
}

/**
 * @param {string} value
 * @returns {string}
 */
function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
