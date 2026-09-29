import { listCart, removeFromCart, setCartQuantity } from "./api/cartApi.js";
import { authErrorMessage, getCurrentProfile } from "./auth.js";
import { mountShell, toast } from "./components.js";
import { formatMoney } from "./format.js";
import { escapeHtml } from "./html.js";
import { imageHtml, productHref, shopName } from "./productView.js";
import { shopHref, shopLogoHtml } from "./shopView.js";
import { loginRedirect, url } from "./paths.js";
import { showState } from "./ui-state.js";

mountShell({ page: "cart" });

const root = document.querySelector("#cart-root");
load();

async function load() {
  if (!root) return;
  try {
    const [lines, profile] = await Promise.all([listCart(), getCurrentProfile()]);
    render(lines, Boolean(profile));
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
  } finally {
    root.setAttribute("aria-busy", "false");
  }
}

/**
 * @param {Array<object>} lines
 * @param {boolean} signedIn
 */
function render(lines, signedIn) {
  if (!root) return;
  if (!lines.length) {
    root.innerHTML = `
      <p class="empty">Your cart is empty. <a href="${url("pages/products.html")}">Browse products</a></p>
    `;
    return;
  }

  /** @type {Map<string, Array<object>>} */
  const groups = new Map();
  for (const line of lines) {
    const key = line.shopSlug || line.shopName || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }

  const subtotals = new Map();
  for (const line of lines) {
    if (!line.billable) continue;
    subtotals.set(line.currency, (subtotals.get(line.currency) || 0) + line.lineTotal);
  }

  const guestNote = signedIn
    ? ""
    : `<p class="notice">This cart is saved on this device. <a href="${loginRedirect()}">Sign in</a> to keep it on your account.</p>`;

  const shops = [...groups.entries()].map(([, shopLines]) => {
    const first = shopLines[0];
    const name = first?.shopName || shopName(first?.product);
    const slug = first?.shopSlug || null;
    const logoShop = { shop_name: name, logo_url: first?.shopLogo || null };
    const storeTotal = new Map();
    for (const line of shopLines) {
      if (!line.billable) continue;
      storeTotal.set(line.currency, (storeTotal.get(line.currency) || 0) + line.lineTotal);
    }
    const storeSubtotal = [...storeTotal.entries()]
      .map(([currency, amount]) => formatMoney(amount, currency))
      .join(" · ") || formatMoney(0, "BDT");

    const head = slug
      ? `<a class="cart-shop-head" href="${shopHref(slug)}">${shopLogoHtml(logoShop, "shop-logo-xs")}<strong>${escapeHtml(name)}</strong></a>`
      : `<div class="cart-shop-head">${shopLogoHtml(logoShop, "shop-logo-xs")}<strong>${escapeHtml(name)}</strong></div>`;

    return `
      <section class="cart-shop">
        ${head}
        ${shopLines.map((line) => lineHtml(line)).join("")}
        <div class="cart-shop-meta">
          <span class="shipping-note">Shipping: calculated at checkout</span>
          <strong>Store subtotal ${escapeHtml(storeSubtotal)}</strong>
        </div>
      </section>
    `;
  }).join("");

  const totals = [...subtotals.entries()].map(([currency, amount]) => `
    <p class="subtotal"><span>Subtotal</span><strong>${escapeHtml(formatMoney(amount, currency))}</strong></p>
  `).join("") || `<p class="subtotal"><span>Subtotal</span><strong>${escapeHtml(formatMoney(0, "BDT"))}</strong></p>`;

  root.innerHTML = `
    ${guestNote}
    <div class="cart-layout">
      <div>${shops}</div>
      <aside class="summary">
        ${totals}
        <p class="muted">Unavailable and out-of-stock items are left out of the subtotal.</p>
        <button class="button button-primary" type="button" id="go-checkout">Proceed to checkout</button>
      </aside>
    </div>
  `;

  root.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => change(button.getAttribute("data-remove"), "remove"));
  });
  root.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-product") || "";
      const input = root.querySelector(`[data-qty='${CSS.escape(id)}']`);
      const current = input instanceof HTMLInputElement ? Number(input.value) : 1;
      const next = current + Number(button.getAttribute("data-step"));
      change(id, next);
    });
  });
  root.querySelectorAll("[data-qty]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!(input instanceof HTMLInputElement)) return;
      change(input.getAttribute("data-qty"), Number(input.value));
    });
  });

  root.querySelector("#go-checkout")?.addEventListener("click", () => {
    window.location.assign(url("pages/checkout.html"));
  });
}

/**
 * @param {object} line
 * @returns {string}
 */
function lineHtml(line) {
  const product = line.product;
  const title = product?.title || "Unavailable product";
  const href = product?.slug ? productHref(product) : "";
  const titleHtml = href ? `<a href="${href}">${escapeHtml(title)}</a>` : escapeHtml(title);
  const max = line.stock > 0 ? line.stock : 1;
  const locked = !product || line.stock < 1;
  const money = line.billable ? formatMoney(line.lineTotal, line.currency) : "—";
  const warnings = line.warnings.map((warning) => `<p class="warning">${escapeHtml(warning)}</p>`).join("");
  const disabled = locked ? "disabled" : "";

  return `
    <article class="cart-line">
      <div class="cart-thumb">${product ? imageHtml(product) : `<span class="product-fallback">?</span>`}</div>
      <div>
        <h3>${titleHtml}</h3>
        <p class="muted">${line.unitPrice != null ? escapeHtml(formatMoney(line.unitPrice, line.currency)) : ""}</p>
        ${warnings}
        <div class="qty">
          <button type="button" data-step="-1" data-product="${escapeHtml(line.productId)}" aria-label="Decrease quantity" ${disabled}>−</button>
          <label class="sr-only" for="qty-${escapeHtml(line.productId)}">Quantity</label>
          <input id="qty-${escapeHtml(line.productId)}" data-qty="${escapeHtml(line.productId)}" type="number" min="1" max="${max}" value="${escapeHtml(String(line.quantity))}" ${disabled}>
          <button type="button" data-step="1" data-product="${escapeHtml(line.productId)}" aria-label="Increase quantity" ${disabled}>+</button>
          <button class="button button-ghost" type="button" data-remove="${escapeHtml(line.productId)}">Remove</button>
        </div>
      </div>
      <p class="line-total">${escapeHtml(money)}</p>
    </article>
  `;
}

/**
 * @param {string | null} productId
 * @param {number | "remove"} quantity
 */
async function change(productId, quantity) {
  if (!productId) return;
  try {
    if (quantity === "remove" || Number(quantity) < 1) await removeFromCart(productId);
    else {
      const result = await setCartQuantity(productId, Number(quantity));
      if (result?.capped) toast(`Only ${result.stock} in stock.`, "info");
    }
    await load();
  } catch (error) {
    toast(authErrorMessage(error), "error");
  }
}
