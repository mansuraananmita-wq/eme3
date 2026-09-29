import { authErrorMessage, redirectAfterAuth, signUp } from "./auth.js";
import { mountShell, toast } from "./components.js";
import { url } from "./paths.js";

mountShell({ page: "register" });

const form = document.querySelector("#register-form");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const fullName = String(data.get("full_name") || "").trim();
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
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
  if (!valid) return;

  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;

  try {
    const result = await signUp(email, password, fullName);
    if (result.needsEmailConfirm) {
      toast("Account created. Confirm the email, then sign in.", "success");
      window.location.assign(url("pages/login.html"));
      return;
    }
    toast("Account created.", "success");
    window.location.assign(redirectAfterAuth());
  } catch (error) {
    toast(authErrorMessage(error), "error");
    if (button) button.disabled = false;
  }
});

document.querySelector("#login-link")?.setAttribute("href", url("pages/login.html"));
