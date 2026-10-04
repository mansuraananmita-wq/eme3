import { authErrorMessage, signUp } from "./auth.js?v=3";
import { mergeGuestCart } from "./api/cartApi.js";
import { mountShell, toast } from "./components.js?v=9";
import { safeNext, url } from "./paths.js?v=4";

mountShell({ page: "register" });

const form = document.querySelector("#register-form");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const fullName = String(data.get("full_name") || "").trim();
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  const roleValue = String(data.get("signup_role") || "customer");
  const role = roleValue === "vendor" || roleValue === "admin" ? roleValue : "customer";
  const shopName = String(data.get("shop_name") || "").trim();
  const fields = {
    full_name: document.querySelector("#name-error"),
    email: document.querySelector("#email-error"),
    password: document.querySelector("#password-error"),
  };
  for (const node of Object.values(fields)) {
    if (node) node.textContent = "";
  }

  let valid = true;
  if (fullName.length < 1 || fullName.length > 120) {
    if (fields.full_name) fields.full_name.textContent = "Name must be 1 to 120 characters.";
    valid = false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (fields.email) fields.email.textContent = "Enter a valid email address.";
    valid = false;
  }
  if (password.length < 6) {
    if (fields.password) fields.password.textContent = "Password must be at least 6 characters.";
    valid = false;
  }
  const shopError = document.querySelector("#shop-error");
  if (shopError) shopError.textContent = "";
  if (role === "vendor" && (shopName.length < 2 || shopName.length > 80)) {
    if (shopError) shopError.textContent = "Shop name must be 2 to 80 characters.";
    valid = false;
  }
  if (!valid) return;

  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;

  try {
    const result = await signUp(email, password, fullName, role, shopName);
    const back = new URLSearchParams(window.location.search).get("redirect");
    if (result.needsEmailConfirm) {
      toast("Account created. Confirm the email, then sign in.", "success");
      const next = back || (role === "vendor" ? "pages/vendor.html" : role === "admin" ? "pages/admin.html" : "pages/customer.html");
      window.location.assign(`${url("pages/login.html")}?redirect=${encodeURIComponent(next)}`);
      return;
    }
    try {
      await mergeGuestCart();
    } catch (error) {
      toast(authErrorMessage(error), "error");
    }
    toast("Account created.", "success");
    const asked = new URLSearchParams(window.location.search).get("redirect");
    const home = role === "vendor"
      ? "pages/vendor.html"
      : role === "admin"
        ? "pages/admin.html"
        : "pages/customer.html";
    window.location.assign(asked ? safeNext(asked) : url(home));
  } catch (error) {
    toast(authErrorMessage(error), "error");
    if (button) button.disabled = false;
  }
});

const back = new URLSearchParams(window.location.search).get("redirect");
const extra = back ? `?redirect=${encodeURIComponent(back)}` : "";
document.querySelector("#login-link")?.setAttribute("href", `${url("pages/login.html")}${extra}`);

const shopField = document.querySelector("#shop-name-field");

function syncShopField() {
  const vendor = form?.querySelector("[name='signup_role'][value='vendor']");
  const showShop = vendor instanceof HTMLInputElement && vendor.checked;
  if (shopField instanceof HTMLElement) {
    shopField.hidden = !showShop;
    shopField.style.display = showShop ? "grid" : "none";
  }
}

form?.querySelectorAll("[name='signup_role']").forEach((input) => {
  input.addEventListener("change", syncShopField);
});
syncShopField();
