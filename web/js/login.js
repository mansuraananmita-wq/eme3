import { authErrorMessage, redirectAfterAuth, signIn } from "./auth.js";
import { mergeGuestCart } from "./api/cartApi.js";
import { mountShell, toast } from "./components.js";
import { url } from "./paths.js";

mountShell({ page: "login" });

const form = document.querySelector("#login-form");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = String(new FormData(form).get("email") || "").trim();
  const password = String(new FormData(form).get("password") || "");
  const emailError = document.querySelector("#email-error");
  const passwordError = document.querySelector("#password-error");
  if (emailError) emailError.textContent = "";
  if (passwordError) passwordError.textContent = "";

  let valid = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (emailError) emailError.textContent = "Enter a valid email address.";
    valid = false;
  }
  if (password.length < 6) {
    if (passwordError) passwordError.textContent = "Password must be at least 6 characters.";
    valid = false;
  }
  if (!valid) return;

  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;

  try {
    await signIn(email, password);
    try {
      await mergeGuestCart();
    } catch (error) {
      toast(authErrorMessage(error), "error");
    }
    toast("Signed in.", "success");
    window.location.assign(redirectAfterAuth());
  } catch (error) {
    toast(authErrorMessage(error), "error");
    if (button) button.disabled = false;
  }
});

const params = new URLSearchParams(window.location.search);
const redirect = params.get("redirect") || params.get("next");
const extra = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
document.querySelector("#register-link")?.setAttribute("href", `${url("pages/register.html")}${extra}`);
