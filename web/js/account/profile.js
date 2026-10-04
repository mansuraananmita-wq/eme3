import { mountAccountNav } from "../accountShell.js";
import { changePassword, getAccountProfile, updateProfile, uploadAvatar } from "../api/profileApi.js";
import { authErrorMessage, requireUser } from "../auth.js?v=3";
import { mountShell, toast } from "../components.js?v=6";
import { escapeHtml } from "../html.js";
import { showState } from "../ui-state.js";

const root = document.querySelector("#profile-root");

boot();

async function boot() {
  const profile = await requireUser();
  if (!profile) return;
  mountShell({ page: "account" });
  mountAccountNav("profile");
  await load();
}

async function load() {
  if (!root) return;
  root.setAttribute("aria-busy", "true");
  try {
    const { profile, email } = await getAccountProfile();
    render(profile, email);
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => load());
  }
}

/**
 * @param {object} profile
 * @param {string | null} email
 */
function render(profile, email) {
  if (!root) return;
  const letter = (profile.full_name || email || "?").slice(0, 1).toUpperCase();
  const avatar = profile.avatar_url
    ? `<img class="avatar-preview" src="${escapeHtml(profile.avatar_url)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
       <span class="avatar-fallback" hidden>${escapeHtml(letter)}</span>`
    : `<span class="avatar-fallback">${escapeHtml(letter)}</span>`;

  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <section class="account-card">
      <div class="avatar-row">
        <div>${avatar}</div>
        <div>
          <label class="button button-ghost">
            Change photo
            <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
          </label>
          <p class="muted">JPEG, PNG, WebP or GIF · max 2 MB</p>
        </div>
      </div>
    </section>

    <form class="account-card" id="profile-form">
      <h2>Details</h2>
      <div class="readonly-row">
        <span class="muted">Email</span>
        <strong>${escapeHtml(email || "—")}</strong>
      </div>
      <div class="readonly-row">
        <span class="muted">Role</span>
        <strong>${escapeHtml(profile.role)}</strong>
      </div>
      <label class="field">
        <span>Full name</span>
        <input name="full_name" maxlength="120" value="${escapeHtml(profile.full_name || "")}">
      </label>
      <label class="field">
        <span>Phone</span>
        <input name="phone" maxlength="20" inputmode="tel" placeholder="01XXXXXXXXX" value="${escapeHtml(profile.phone || "")}">
      </label>
      <button class="button button-primary" type="submit">Save profile</button>
    </form>

    <form class="account-card" id="password-form">
      <h2>Password</h2>
      <label class="field">
        <span>New password</span>
        <input name="password" type="password" autocomplete="new-password" minlength="6" required>
      </label>
      <label class="field">
        <span>Confirm password</span>
        <input name="confirm" type="password" autocomplete="new-password" minlength="6" required>
      </label>
      <button class="button button-primary" type="submit">Update password</button>
    </form>
  `;

  root.querySelector("#avatar-input")?.addEventListener("change", async (event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    try {
      await uploadAvatar(input.files[0]);
      toast("Avatar updated.", "success");
      await load();
    } catch (error) {
      toast(authErrorMessage(error), "error");
    } finally {
      input.value = "";
    }
  });

  root.querySelector("#profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button[type='submit']");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await updateProfile({
        full_name: String(data.get("full_name") || ""),
        phone: String(data.get("phone") || ""),
      });
      toast("Profile saved.", "success");
      await load();
    } catch (error) {
      toast(authErrorMessage(error), "error");
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });

  root.querySelector("#password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirm") || "");
    if (password !== confirm) {
      toast("Passwords do not match.", "error");
      return;
    }
    const button = event.currentTarget.querySelector("button[type='submit']");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await changePassword(password);
      toast("Password updated.", "success");
      event.currentTarget.reset();
    } catch (error) {
      toast(authErrorMessage(error), "error");
    } finally {
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });
}
