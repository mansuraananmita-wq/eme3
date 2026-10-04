import { listCategories } from "./api/categoriesApi.js";
import { getMyShopApplication, slugifyShopName } from "./api/shopsApi.js";
import {
  createScheduledLive,
  deleteProduct,
  deleteProductImage,
  listMyConversations,
  listMyLives,
  listMyPayouts,
  listMyProducts,
  pinLiveProduct,
  saveProduct,
  setLiveProducts,
  setLiveStatus,
  setPrimaryImage,
  slugifyProductTitle,
  updateMyShop,
  uploadLiveThumbnail,
  uploadProductImage,
  uploadShopImage,
} from "./api/vendorApi.js";
import { authErrorMessage, claimAccountRole, requireUser, roleChangeMessage } from "./auth.js";
import { mountShell, openModal, toast } from "./components.js";
import { formatMoney } from "./format.js";
import { escapeHtml } from "./html.js";
import { productImageUrl } from "./media.js";
import { url } from "./paths.js";
import { showState } from "./ui-state.js";

mountShell({ page: "account" });

const root = document.querySelector("#vendor-root");

/** @type {object | null} */
let shop = null;
/** @type {boolean} */
let approved = false;
/** @type {string} */
let tab = "products";
/** @type {Array<object>} */
let categories = [];
/** @type {string | null} */
let editingId = null;
/** @type {boolean} */
let creating = false;

async function boot() {
  if (!(root instanceof HTMLElement)) return;
  const profile = await requireUser();
  if (!profile) return;

  try {
    shop = await getMyShopApplication();
    if (!shop) {
      root.setAttribute("aria-busy", "false");
      root.innerHTML = `
        <div class="account-card">
          <h2>Vendor studio</h2>
          <p>This is the vendor page. Products, the shop, and Go live live here. This login does not have a shop yet.</p>
          <label class="field">
            <span>Shop name</span>
            <input id="claim-shop-name" maxlength="80" placeholder="My shop" value="${escapeHtml(profile.full_name || "")}">
          </label>
          <button class="button button-primary" type="button" id="become-vendor">Open my studio</button>
          <p class="muted">Customers watch at <a href="${url("pages/lives.html")}">Live</a> after you press Go live.</p>
        </div>
      `;
      root.querySelector("#become-vendor")?.addEventListener("click", async () => {
        const input = root.querySelector("#claim-shop-name");
        const shopName = input instanceof HTMLInputElement ? input.value.trim() : "";
        try {
          await claimAccountRole("vendor", shopName);
          toast("Studio is open. Use the Live tab to go on air.", "success");
          window.location.reload();
        } catch (error) {
          console.error("claim vendor:", error);
          toast(roleChangeMessage(error), "error");
        }
      });
      return;
    }
    approved = shop.status === "approved";
    categories = await listCategories();
    render();
  } catch (error) {
    console.error("Vendor studio:", error);
    root.setAttribute("aria-busy", "false");
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, message, boot);
  }
}

function render() {
  if (!(root instanceof HTMLElement) || !shop) return;
  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <p class="muted">${escapeHtml(shop.shop_name)} · ${escapeHtml(shop.status)}</p>
    <div class="admin-tabs" role="tablist">
      ${tabButton("products", "Products")}
      ${tabButton("shop", "Shop")}
      ${tabButton("live", "Live")}
      ${tabButton("payouts", "Payouts")}
      ${tabButton("messages", "Messages")}
    </div>
    <div id="studio-panel" aria-busy="true"><div class="skeleton skeleton-card"></div></div>
  `;
  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      tab = button.getAttribute("data-tab") || "products";
      editingId = null;
      creating = false;
      render();
    });
  });
  loadTab();
}

/**
 * @param {string} id
 * @param {string} label
 * @returns {string}
 */
function tabButton(id, label) {
  return `<button type="button" role="tab" data-tab="${id}" class="${tab === id ? "is-active" : ""}" aria-selected="${tab === id ? "true" : "false"}">${label}</button>`;
}

async function loadTab() {
  const panel = root?.querySelector("#studio-panel");
  if (!(panel instanceof HTMLElement)) return;
  try {
    if (tab === "products") await renderProducts(panel);
    else if (tab === "shop") renderShop(panel);
    else if (tab === "live") await renderLives(panel);
    else if (tab === "payouts") await renderPayouts(panel);
    else await renderMessages(panel);
  } catch (error) {
    console.error("Studio tab:", error);
    panel.setAttribute("aria-busy", "false");
    toast(authErrorMessage(error), "error");
    showState(panel, authErrorMessage(error), loadTab);
  }
}

/**
 * @param {HTMLElement} panel
 */
async function renderProducts(panel) {
  if (!approved) {
    panel.setAttribute("aria-busy", "false");
    panel.innerHTML = `<div class="account-card"><p>Product tools open after an admin approves this shop. You can still edit the shop name and description.</p></div>`;
    return;
  }

  const products = await listMyProducts();
  const editing = creating ? { status: "draft", currency: "BDT", stock: 0, images: [] } : products.find((row) => row.id === editingId);

  panel.setAttribute("aria-busy", "false");
  panel.innerHTML = `
    <div class="studio-toolbar">
      <button class="button button-primary" type="button" id="new-product">New product</button>
    </div>
    ${editing ? productForm(editing) : ""}
    <div class="admin-list">
      ${products.map((product) => productRow(product)).join("") || `<p class="muted">No products yet.</p>`}
    </div>
  `;

  panel.querySelector("#new-product")?.addEventListener("click", () => {
    creating = true;
    editingId = null;
    renderProducts(panel);
  });
  panel.querySelector("#cancel-product")?.addEventListener("click", () => {
    creating = false;
    editingId = null;
    renderProducts(panel);
  });
  bindProductForm(panel, editing);
  panel.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editingId = button.getAttribute("data-edit");
      creating = false;
      renderProducts(panel);
    });
  });
  panel.querySelectorAll("[data-archive]").forEach((button) => {
    button.addEventListener("click", () => toggleArchive(button, products, panel));
  });
  panel.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => confirmDelete(button.getAttribute("data-delete") || "", panel));
  });
}

/**
 * @param {object} product
 * @returns {string}
 */
function productRow(product) {
  return `
    <article class="account-card studio-product">
      <img class="studio-thumb" src="${escapeHtml(product.imageUrl || "")}" alt="" onerror="this.hidden=true">
      <div>
        <strong>${escapeHtml(product.title)}</strong>
        <p class="muted">${escapeHtml(formatMoney(product.price, product.currency || "BDT"))} · stock ${escapeHtml(String(product.stock))} · ${escapeHtml(product.status)}</p>
      </div>
      <div class="vendor-orders-links">
        <button class="button button-ghost" type="button" data-edit="${escapeHtml(product.id)}">Edit</button>
        <button class="button button-ghost" type="button" data-archive="${escapeHtml(product.id)}">${product.status === "archived" ? "Unarchive" : "Archive"}</button>
        <button class="button button-ghost" type="button" data-delete="${escapeHtml(product.id)}">Delete</button>
      </div>
    </article>
  `;
}

/**
 * @param {object} product
 * @returns {string}
 */
function productForm(product) {
  const options = categories.map((category) => `
    <option value="${escapeHtml(category.id)}" ${category.id === product.category_id ? "selected" : ""}>${escapeHtml(category.name)}</option>
  `).join("");
  const images = (product.images || []).map((image) => `
    <li>
      <img src="${escapeHtml(productImageUrl(image.storage_path))}" alt="">
      <span>${image.is_primary ? "Primary" : "Photo"}</span>
      ${image.is_primary ? "" : `<button class="button button-ghost" type="button" data-primary="${escapeHtml(image.id)}">Make primary</button>`}
      <button class="button button-ghost" type="button" data-drop-image="${escapeHtml(image.id)}">Remove</button>
    </li>
  `).join("");

  return `
    <form id="product-form" class="account-card" novalidate>
      <h2>${product.id ? "Edit product" : "New product"}</h2>
      <label class="field"><span>Title</span><input name="title" required maxlength="180" value="${escapeHtml(product.title || "")}"></label>
      <label class="field"><span>Slug</span><input name="slug" required maxlength="180" value="${escapeHtml(product.slug || "")}" pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"></label>
      <label class="field"><span>Category</span><select name="category_id" required><option value="">Choose</option>${options}</select></label>
      <label class="field"><span>Description</span><textarea name="description" rows="4" maxlength="4000">${escapeHtml(product.description || "")}</textarea></label>
      <label class="field"><span>Price (BDT)</span><input name="price" type="number" min="0" step="0.01" required value="${escapeHtml(product.price ?? "")}"></label>
      <label class="field"><span>Compare-at price</span><input name="compare_at_price" type="number" min="0" step="0.01" value="${escapeHtml(product.compare_at_price ?? "")}"></label>
      <label class="field"><span>Stock</span><input name="stock" type="number" min="0" step="1" required value="${escapeHtml(String(product.stock ?? 0))}"></label>
      <label class="field"><span>SKU</span><input name="sku" maxlength="64" value="${escapeHtml(product.sku || "")}"></label>
      <label class="field"><span>Status</span>
        <select name="status">
          <option value="draft" ${product.status === "draft" ? "selected" : ""}>Draft</option>
          <option value="active" ${product.status === "active" ? "selected" : ""}>Active</option>
          <option value="archived" ${product.status === "archived" ? "selected" : ""}>Archived</option>
        </select>
      </label>
      ${product.id ? `
        <div class="field">
          <span>Photos</span>
          <ul class="studio-images" id="product-images">${images || "<li class='muted'>No photos yet.</li>"}</ul>
          <input id="product-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
        </div>
      ` : `<p class="muted">Save the product, then add photos. Files go to your folder in product-images.</p>`}
      <div class="vendor-orders-links">
        <button class="button button-primary" type="submit">Save product</button>
        <button class="button button-ghost" type="button" id="cancel-product">Cancel</button>
      </div>
    </form>
  `;
}

/**
 * @param {HTMLElement} panel
 * @param {object | undefined} product
 */
function bindProductForm(panel, product) {
  const form = panel.querySelector("#product-form");
  if (!(form instanceof HTMLFormElement)) return;
  const title = form.querySelector("[name='title']");
  const slug = form.querySelector("[name='slug']");
  title?.addEventListener("input", () => {
    if (slug instanceof HTMLInputElement && !slug.dataset.touched && !product?.id) {
      slug.value = slugifyProductTitle(title.value);
    }
  });
  slug?.addEventListener("input", () => {
    if (slug instanceof HTMLInputElement) slug.dataset.touched = "1";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector("[type='submit']");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      const id = await saveProduct({
        id: product?.id,
        title: data.get("title"),
        slug: data.get("slug"),
        category_id: data.get("category_id"),
        description: data.get("description"),
        price: data.get("price"),
        compare_at_price: data.get("compare_at_price"),
        stock: data.get("stock"),
        sku: data.get("sku"),
        status: data.get("status"),
      });
      toast("Product saved.", "success");
      creating = false;
      editingId = id;
      await renderProducts(panel);
    } catch (error) {
      console.error("Save product:", error);
      toast(authErrorMessage(error), "error");
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });

  if (!product?.id) return;
  panel.querySelector("#product-photo")?.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    try {
      await uploadProductImage(product.id, input.files[0]);
      toast("Photo added.", "success");
      await renderProducts(panel);
    } catch (error) {
      console.error("Upload product image:", error);
      toast(authErrorMessage(error), "error");
    }
  });
  panel.querySelectorAll("[data-primary]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await setPrimaryImage(product.id, button.getAttribute("data-primary") || "");
        await renderProducts(panel);
      } catch (error) {
        console.error("Primary image:", error);
        toast(authErrorMessage(error), "error");
      }
    });
  });
  panel.querySelectorAll("[data-drop-image]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await deleteProductImage(button.getAttribute("data-drop-image") || "");
        await renderProducts(panel);
      } catch (error) {
        console.error("Delete product image:", error);
        toast(authErrorMessage(error), "error");
      }
    });
  });
}

/**
 * @param {Element} button
 * @param {Array<object>} products
 * @param {HTMLElement} panel
 */
async function toggleArchive(button, products, panel) {
  const id = button.getAttribute("data-archive") || "";
  const product = products.find((row) => row.id === id);
  if (!product || !(button instanceof HTMLButtonElement)) return;
  button.disabled = true;
  try {
    await saveProduct({
      ...product,
      status: product.status === "archived" ? "draft" : "archived",
    });
    toast(product.status === "archived" ? "Moved to draft." : "Archived.", "success");
    await renderProducts(panel);
  } catch (error) {
    console.error("Archive product:", error);
    toast(authErrorMessage(error), "error");
    button.disabled = false;
  }
}

/**
 * @param {string} id
 * @param {HTMLElement} panel
 */
function confirmDelete(id, panel) {
  openModal({
    title: "Delete product",
    body: "This removes the product. It fails if an order already includes it.",
    confirmLabel: "Delete",
    onConfirm: async () => {
      try {
        await deleteProduct(id);
        toast("Product deleted.", "success");
        editingId = null;
        await renderProducts(panel);
      } catch (error) {
        console.error("Delete product:", error);
        toast(authErrorMessage(error), "error");
      }
    },
  });
}

/**
 * @param {HTMLElement} panel
 */
function renderShop(panel) {
  if (!shop) return;
  panel.setAttribute("aria-busy", "false");
  panel.innerHTML = `
    <form id="shop-form" class="account-card" novalidate>
      <h2>Shop profile</h2>
      <p class="muted">${approved ? "Logo and banner files upload to shop-media." : "Photo upload starts after approval. You can paste an image URL until then."}</p>
      <label class="field"><span>Shop name</span><input name="shop_name" required maxlength="80" value="${escapeHtml(shop.shop_name || "")}"></label>
      <label class="field"><span>Slug</span><input name="slug" required maxlength="80" value="${escapeHtml(shop.slug || "")}"></label>
      <label class="field"><span>Description</span><textarea name="description" rows="4" maxlength="500">${escapeHtml(shop.description || "")}</textarea></label>
      <label class="field"><span>Logo URL</span><input name="logo_url" type="url" value="${escapeHtml(shop.logo_url || "")}"></label>
      <label class="field"><span>Banner URL</span><input name="banner_url" type="url" value="${escapeHtml(shop.banner_url || "")}"></label>
      ${approved ? `
        <label class="field"><span>Upload logo</span><input id="logo-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
        <label class="field"><span>Upload banner</span><input id="banner-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
      ` : ""}
      <button class="button button-primary" type="submit">Save shop</button>
      <a href="${url("pages/shop.html")}?slug=${encodeURIComponent(shop.slug)}">View storefront</a>
    </form>
  `;
  const form = panel.querySelector("#shop-form");
  const name = form?.querySelector("[name='shop_name']");
  const slug = form?.querySelector("[name='slug']");
  name?.addEventListener("input", () => {
    if (slug instanceof HTMLInputElement && !slug.dataset.touched) slug.value = slugifyShopName(name.value);
  });
  slug?.addEventListener("input", () => {
    if (slug instanceof HTMLInputElement) slug.dataset.touched = "1";
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    try {
      await updateMyShop({
        shop_name: String(data.get("shop_name") || ""),
        slug: String(data.get("slug") || ""),
        description: String(data.get("description") || ""),
        logo_url: String(data.get("logo_url") || ""),
        banner_url: String(data.get("banner_url") || ""),
      });
      shop = await getMyShopApplication();
      toast("Shop saved.", "success");
      render();
    } catch (error) {
      console.error("Save shop:", error);
      toast(authErrorMessage(error), "error");
    }
  });
  panel.querySelector("#logo-file")?.addEventListener("change", (event) => uploadShopFile(event, "logo"));
  panel.querySelector("#banner-file")?.addEventListener("change", (event) => uploadShopFile(event, "banner"));
}

/**
 * @param {Event} event
 * @param {"logo" | "banner"} kind
 */
async function uploadShopFile(event, kind) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
  try {
    await uploadShopImage(kind, input.files[0]);
    shop = await getMyShopApplication();
    toast("Image uploaded.", "success");
    render();
  } catch (error) {
    console.error("Shop image:", error);
    toast(authErrorMessage(error), "error");
  }
}

/**
 * @param {HTMLElement} panel
 */
async function renderLives(panel) {
  if (!approved) {
    panel.setAttribute("aria-busy", "false");
    panel.innerHTML = `
      <div class="account-card">
        <p>This shop is still pending, so Go live stays closed. Approve it on this account to host. Customers then watch the room on the Live page.</p>
        <button class="button button-primary" type="button" id="approve-shop">Approve my shop and open live</button>
      </div>
    `;
    panel.querySelector("#approve-shop")?.addEventListener("click", async () => {
      try {
        await claimAccountRole("vendor");
        toast("Shop approved. You can go live.", "success");
        window.location.reload();
      } catch (error) {
        console.error("approve shop:", error);
        toast(roleChangeMessage(error), "error");
      }
    });
    return;
  }
  const [lives, products] = await Promise.all([listMyLives(), listMyProducts()]);
  const sellable = products.filter((product) => product.status === "active");
  panel.setAttribute("aria-busy", "false");
  panel.innerHTML = `
    <form id="live-form" class="account-card" novalidate>
      <h2>Schedule a live</h2>
      <label class="field"><span>Title</span><input name="title" required maxlength="140"></label>
      <label class="field"><span>Description</span><textarea name="description" rows="3" maxlength="500"></textarea></label>
      <label class="field"><span>Starts</span><input name="scheduled_at" type="datetime-local" required></label>
      <button class="button button-primary" type="submit">Create scheduled live</button>
    </form>
    <div class="admin-list">
      ${lives.map((stream) => liveCard(stream, sellable)).join("") || `<p class="muted">No live rooms yet.</p>`}
    </div>
  `;
  panel.querySelector("#live-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    try {
      await createScheduledLive({
        title: String(data.get("title") || ""),
        description: String(data.get("description") || ""),
        scheduled_at: String(data.get("scheduled_at") || ""),
      });
      toast("Live scheduled.", "success");
      await renderLives(panel);
    } catch (error) {
      console.error("Create live:", error);
      toast(authErrorMessage(error), "error");
    }
  });
  panel.querySelectorAll("[data-go-live]").forEach((button) => {
    button.addEventListener("click", () => changeLive(button.getAttribute("data-go-live") || "", "live", panel));
  });
  panel.querySelectorAll("[data-end-live]").forEach((button) => {
    button.addEventListener("click", () => changeLive(button.getAttribute("data-end-live") || "", "ended", panel));
  });
  panel.querySelectorAll("[data-save-products]").forEach((button) => {
    button.addEventListener("click", () => saveAttached(button, lives, panel));
  });
  panel.querySelectorAll("[data-pin]").forEach((button) => {
    button.addEventListener("click", () => savePin(button, panel));
  });
  panel.querySelectorAll("[data-thumb]").forEach((input) => {
    input.addEventListener("change", () => saveThumb(input, panel));
  });
}

/**
 * @param {object} stream
 * @param {Array<object>} products
 * @returns {string}
 */
function liveCard(stream, products) {
  const attached = new Set((stream.live_stream_products || []).map((row) => row.product_id));
  const checks = products.map((product) => `
    <label class="studio-check">
      <input type="checkbox" name="product" value="${escapeHtml(product.id)}" ${attached.has(product.id) ? "checked" : ""}>
      ${escapeHtml(product.title)}
    </label>
  `).join("");
  const pinOptions = products.filter((product) => attached.has(product.id)).map((product) => `
    <option value="${escapeHtml(product.id)}" ${stream.pinned_product_id === product.id ? "selected" : ""}>${escapeHtml(product.title)}</option>
  `).join("");
  const when = stream.scheduled_at ? new Date(stream.scheduled_at).toLocaleString() : "";
  return `
    <article class="account-card">
      <strong>${escapeHtml(stream.title)}</strong>
      <p class="muted">${escapeHtml(stream.status)}${when ? ` · ${escapeHtml(when)}` : ""}</p>
      <div class="vendor-orders-links">
        ${stream.status === "scheduled" ? `<button class="button button-primary" type="button" data-go-live="${escapeHtml(stream.id)}">Go live</button>` : ""}
        ${stream.status === "live" ? `<button class="button button-ghost" type="button" data-end-live="${escapeHtml(stream.id)}">End live</button>` : ""}
        <a class="button button-ghost" href="${url("pages/live.html")}?id=${encodeURIComponent(stream.id)}">Open room</a>
      </div>
      <label class="field"><span>Thumbnail</span><input data-thumb="${escapeHtml(stream.id)}" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
      <div class="studio-checks">${checks || `<p class="muted">Publish an active product before attaching it.</p>`}</div>
      <button class="button button-ghost" type="button" data-save-products="${escapeHtml(stream.id)}">Save attached products</button>
      <label class="field"><span>Pinned product</span>
        <select data-pin-select="${escapeHtml(stream.id)}">
          <option value="">None</option>
          ${pinOptions}
        </select>
      </label>
      <button class="button button-ghost" type="button" data-pin="${escapeHtml(stream.id)}">Save pin</button>
    </article>
  `;
}

/**
 * @param {string} id
 * @param {"live" | "ended"} status
 * @param {HTMLElement} panel
 */
async function changeLive(id, status, panel) {
  try {
    await setLiveStatus(id, status);
    toast(status === "live" ? "You are live." : "Live ended.", "success");
    await renderLives(panel);
  } catch (error) {
    console.error("Live status:", error);
    toast(authErrorMessage(error), "error");
  }
}

/**
 * @param {Element} button
 * @param {Array<object>} lives
 * @param {HTMLElement} panel
 */
async function saveAttached(button, lives, panel) {
  const id = button.getAttribute("data-save-products") || "";
  const stream = lives.find((row) => row.id === id);
  const card = button.closest("article");
  const ids = [...(card?.querySelectorAll("input[name='product']:checked") || [])].map((input) => input.value);
  try {
    if (stream?.pinned_product_id && !ids.includes(stream.pinned_product_id)) {
      await pinLiveProduct(id, null);
    }
    await setLiveProducts(id, ids);
    toast("Products updated.", "success");
    await renderLives(panel);
  } catch (error) {
    console.error("Live products:", error);
    toast(authErrorMessage(error), "error");
  }
}

/**
 * @param {Element} button
 * @param {HTMLElement} panel
 */
async function savePin(button, panel) {
  const id = button.getAttribute("data-pin") || "";
  const select = panel.querySelector(`[data-pin-select="${CSS.escape(id)}"]`);
  const productId = select instanceof HTMLSelectElement ? select.value || null : null;
  try {
    await pinLiveProduct(id, productId);
    toast("Pin saved.", "success");
    await renderLives(panel);
  } catch (error) {
    console.error("Pin product:", error);
    toast(authErrorMessage(error), "error");
  }
}

/**
 * @param {Element} input
 * @param {HTMLElement} panel
 */
async function saveThumb(input, panel) {
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
  try {
    await uploadLiveThumbnail(input.getAttribute("data-thumb") || "", input.files[0]);
    toast("Thumbnail uploaded.", "success");
    await renderLives(panel);
  } catch (error) {
    console.error("Live thumbnail:", error);
    toast(authErrorMessage(error), "error");
  }
}

/**
 * @param {HTMLElement} panel
 */
async function renderPayouts(panel) {
  const rows = await listMyPayouts();
  panel.setAttribute("aria-busy", "false");
  panel.innerHTML = `
    <p class="muted">Payouts are read-only. An admin records them.</p>
    <div class="admin-list">
      ${rows.map((row) => `
        <article class="account-card">
          <strong>${escapeHtml(formatMoney(row.amount, row.currency || "BDT"))}</strong>
          <p class="muted">${escapeHtml(row.status)} · ${escapeHtml(row.period_start || "")} – ${escapeHtml(row.period_end || "")}</p>
          ${row.reference ? `<p>${escapeHtml(row.reference)}</p>` : ""}
        </article>
      `).join("") || `<p class="muted">No payouts yet.</p>`}
    </div>
  `;
}

/**
 * @param {HTMLElement} panel
 */
async function renderMessages(panel) {
  const threads = await listMyConversations();
  const mine = threads.filter((row) => row.vendor_id === shop?.profile_id);
  panel.setAttribute("aria-busy", "false");
  panel.innerHTML = `
    <p class="muted">Customers start a thread from a product page. You can reply here.</p>
    <div class="admin-list">
      ${mine.map((row) => `
        <a class="account-card" href="${url("pages/chat.html")}?id=${encodeURIComponent(row.id)}">
          <strong>${escapeHtml(row.customerName)}</strong>
          <p class="muted">${escapeHtml(new Date(row.created_at).toLocaleString())}</p>
        </a>
      `).join("") || `<p class="muted">No customer messages yet.</p>`}
    </div>
  `;
}

boot();
