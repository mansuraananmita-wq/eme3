import {
  buildCheckoutSummary,
  clearBuyNow,
  DELIVERY_FEES,
  PAYMENT_METHODS,
  placeOrder,
  shippingFeeForAddress,
} from "./api/checkoutApi.js";
import {
  createAddress,
  listAddresses,
  validateAddressInput,
} from "./api/addressApi.js";
import { authErrorMessage, requireUser } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=9";
import { formatMoney } from "./format.js";
import { divisionChoices } from "./bdDivisions.js";
import { escapeHtml } from "./html.js";
import { url } from "./paths.js?v=4";
import { showState } from "./ui-state.js";

const root = document.querySelector("#checkout-root");

/** @type {Array<object>} */
let addresses = [];
/** @type {Awaited<ReturnType<typeof buildCheckoutSummary>> | null} */
let summary = null;
let selectedAddressId = "";
let selectedPayment = "cash_on_delivery";
let placing = false;

boot();

async function boot() {
  const profile = await requireUser();
  if (!profile) return;
  mountShell({ page: "checkout" });
  await load();
}

async function load() {
  if (!root) return;
  root.setAttribute("aria-busy", "true");

  try {
    [summary, addresses] = await Promise.all([
      buildCheckoutSummary(),
      listAddresses(),
    ]);

    if (!summary || summary.empty) {
      clearBuyNow();
      window.location.assign(url("pages/cart.html"));
      return;
    }

    const preferred = addresses.find((row) => row.is_default) || addresses[0];
    selectedAddressId = preferred?.id || "";
    selectedPayment = "cash_on_delivery";
    render();
  } catch (error) {
    console.error("Checkout load:", error);
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
  }
}

function selectedAddress() {
  return addresses.find((row) => row.id === selectedAddressId) || null;
}

function render() {
  if (!root || !summary) return;
  const address = selectedAddress();
  const shipping = shippingFeeForAddress(address || { city: "Dhaka", district: "Dhaka" });
  const grand = summary.subtotal + shipping.amount;
  const buyNote = summary.mode === "buy_now"
    ? `<p class="notice">Buy Now — checking out with this item only. Your other cart items stay in the cart.</p>`
    : "";

  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    ${buyNote}
    <div class="checkout-layout">
      <div class="checkout-steps">
        <section class="checkout-panel">
          <h2 class="checkout-step-title">1. Delivery address / ঠিকানা</h2>
          ${addresses.length
            ? `<div class="address-pick-list" id="address-pick">
                ${addresses.map((row) => `
                  <label class="${row.id === selectedAddressId ? "is-selected" : ""}">
                    <input type="radio" name="address_id" value="${escapeHtml(row.id)}" ${row.id === selectedAddressId ? "checked" : ""}>
                    <span>
                      <strong>${escapeHtml(row.label)}</strong>
                      ${row.is_default ? `<span class="status-badge is-delivered">Default</span>` : ""}
                      <br>${escapeHtml(row.recipient_name)} · ${escapeHtml(row.phone)}
                      <br class="muted">${escapeHtml(row.line1)}, ${escapeHtml(row.city)}, ${escapeHtml(row.district)}
                    </span>
                  </label>
                `).join("")}
              </div>`
            : `<p class="muted">No saved addresses yet. Add one below.</p>`}

          <details ${addresses.length ? "" : "open"}>
            <summary>Add a new address / নতুন ঠিকানা</summary>
            <form id="checkout-address-form" class="address-form" style="margin-top: var(--space-3)">
              <label class="field"><span>Label</span><input name="label" value="Home" required maxlength="40"></label>
              <label class="field"><span>Recipient name / নাম</span><input name="recipient_name" required maxlength="120"></label>
              <label class="field"><span>Phone / মোবাইল</span><input name="phone" required maxlength="20" placeholder="01XXXXXXXXX" inputmode="tel"></label>
              <label class="field"><span>Address line / ঠিকানা</span><input name="line1" required maxlength="180"></label>
              <label class="field"><span>Address line 2</span><input name="line2" maxlength="180"></label>
              <label class="field"><span>Area / city (এলাকা)</span><input name="city" required maxlength="80" placeholder="e.g. Mirpur"></label>
              <label class="field"><span>Division / বিভাগ</span>
                <select name="district" required>
                  <option value="">Choose</option>
                  ${divisionChoices("").map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
                </select>
              </label>
              <label class="field"><span>Postal code</span><input name="postal_code" maxlength="20"></label>
              <label class="field-inline"><input name="is_default" type="checkbox" checked> <span>Set as default</span></label>
              <button class="button button-primary" type="submit">Save address</button>
            </form>
          </details>
        </section>

        <section class="checkout-panel">
          <h2 class="checkout-step-title">2. Delivery / ডেলিভারি</h2>
          <p>
            ${shipping.zone === "dhaka"
              ? `Inside Dhaka · ${escapeHtml(formatMoney(DELIVERY_FEES.insideDhaka, DELIVERY_FEES.currency))}`
              : `Outside Dhaka · ${escapeHtml(formatMoney(DELIVERY_FEES.outsideDhaka, DELIVERY_FEES.currency))}`}
          </p>
          <p class="muted">
            Fee is ${escapeHtml(String(DELIVERY_FEES.insideDhaka))} BDT for the Dhaka division,
            ${escapeHtml(String(DELIVERY_FEES.outsideDhaka))} BDT for the other seven.
            The server checks the division when you place the order.
          </p>
        </section>

        <section class="checkout-panel">
          <h2 class="checkout-step-title">3. Payment / পেমেন্ট</h2>
          <div class="payment-options" id="payment-pick">
            ${PAYMENT_METHODS.filter((method) => method.available).map((method) => `
              <label class="${method.id === selectedPayment ? "is-selected" : ""}">
                <input type="radio" name="payment_method" value="${escapeHtml(method.id)}"
                  ${method.id === selectedPayment ? "checked" : ""}>
                <span>${escapeHtml(method.label)}</span>
              </label>
            `).join("")}
          </div>
          <p class="muted">Cash on delivery stays unpaid until the order is delivered.</p>
        </section>
      </div>

      <aside class="checkout-panel checkout-summary">
        <h2>Order summary</h2>
        ${summary.shops.map((shop) => `
          <div class="checkout-shop">
            <strong>${escapeHtml(shop.shopName)}</strong>
            ${shop.lines.map((line) => `
              <p class="checkout-line">
                <span>${escapeHtml(line.product?.title || "Item")} × ${escapeHtml(String(line.quantity))}</span>
                <span>${escapeHtml(formatMoney(line.lineTotal, line.currency))}</span>
              </p>
            `).join("")}
            <p class="checkout-line muted"><span>Shop subtotal</span><span>${escapeHtml(formatMoney(shop.subtotal, shop.currency))}</span></p>
          </div>
        `).join("")}
        <p class="checkout-line"><span>Subtotal</span><strong>${escapeHtml(formatMoney(summary.subtotal, summary.currency))}</strong></p>
        <p class="checkout-line"><span>Delivery</span><strong>${escapeHtml(formatMoney(shipping.amount, shipping.currency))}</strong></p>
        <p class="checkout-line"><span>Total</span><strong>${escapeHtml(formatMoney(grand, summary.currency))}</strong></p>
        <button class="button button-primary" type="button" id="place-order" ${placing ? "disabled" : ""}>
          ${placing ? "Placing…" : "Place order / অর্ডার করুন"}
        </button>
      </aside>
    </div>
  `;

  root.querySelectorAll("[name='address_id']").forEach((input) => {
    input.addEventListener("change", () => {
      if (input instanceof HTMLInputElement && input.checked) {
        selectedAddressId = input.value;
        render();
      }
    });
  });

  root.querySelectorAll("[name='payment_method']").forEach((input) => {
    input.addEventListener("change", () => {
      if (input instanceof HTMLInputElement && input.checked) {
        selectedPayment = input.value;
        render();
      }
    });
  });

  root.querySelector("#checkout-address-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
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
    try {
      const created = await createAddress(input);
      toast("Address saved.", "success");
      selectedAddressId = created.id;
      addresses = await listAddresses();
      render();
    } catch (error) {
      console.error("Save address:", error);
      toast(authErrorMessage(error), "error");
    }
  });

  root.querySelector("#place-order")?.addEventListener("click", onPlaceOrder);
}

async function onPlaceOrder() {
  if (placing || !root) return;
  if (!selectedAddressId) {
    toast("Add or choose a delivery address.", "error");
    return;
  }

  placing = true;
  const button = root.querySelector("#place-order");
  if (button instanceof HTMLButtonElement) {
    button.disabled = true;
    button.textContent = "Placing…";
  }

  try {
    const result = await placeOrder({
      addressId: selectedAddressId,
      paymentMethod: selectedPayment,
    });
    toast("Order placed.", "success");
    window.location.assign(
      `${url("pages/account/order.html")}?id=${encodeURIComponent(result.orderId)}`,
    );
  } catch (error) {
    console.error("Place order:", error);
    toast(authErrorMessage(error), "error");
    placing = false;
    if (button instanceof HTMLButtonElement) {
      button.disabled = false;
      button.textContent = "Place order / অর্ডার করুন";
    }
  }
}
