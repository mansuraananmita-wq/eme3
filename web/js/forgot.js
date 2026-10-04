import { authErrorMessage, sendPasswordReset } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=8";

mountShell({ page: "login" });

const form = document.querySelector("#forgot-form");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = String(new FormData(form).get("email") || "").trim();
  const emailError = document.querySelector("#email-error");
  if (emailError) emailError.textContent = "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (emailError) emailError.textContent = "Enter a valid email address.";
    return;
  }

  const button = form.querySelector("button[type='submit']");
  if (button instanceof HTMLButtonElement) button.disabled = true;
  try {
    await sendPasswordReset(email);
    toast("Reset link sent. Check your email.", "success");
    form.reset();
  } catch (error) {
    console.error("password reset:", error);
    toast(authErrorMessage(error), "error");
  } finally {
    if (button instanceof HTMLButtonElement) button.disabled = false;
  }
});
