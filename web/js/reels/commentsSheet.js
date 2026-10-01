/**
 * Comments bottom sheet for a reel.
 */

import { listReelComments, postReelComment } from "../api/reelsApi.js";
import { authErrorMessage, getCurrentProfile } from "../auth.js";
import { toast } from "../components.js";
import { escapeHtml } from "../html.js";
import { loginRedirect } from "../paths.js";
import { closeProductSheet } from "./productSheet.js";

/**
 * @param {HTMLElement} host
 * @param {string} reelId
 */
export async function openCommentsSheet(host, reelId) {
  closeProductSheet(host);
  host.querySelectorAll("[data-reel-sheet='comments']").forEach((node) => node.remove());

  const sheet = document.createElement("div");
  sheet.className = "reel-sheet";
  sheet.dataset.reelSheet = "comments";
  sheet.innerHTML = `
    <div class="reel-sheet-backdrop" data-close-sheet></div>
    <div class="reel-sheet-panel" role="dialog" aria-modal="true" aria-label="Comments">
      <div class="reel-sheet-head">
        <h2>Comments</h2>
        <button class="icon-button reel-sheet-close" type="button" data-close-sheet aria-label="Close">×</button>
      </div>
      <div class="reel-comments" data-comments-list aria-busy="true">
        <div class="skeleton skeleton-card"></div>
      </div>
      <form class="reel-comment-form" data-comment-form>
        <label class="sr-only" for="reel-comment-input">Add a comment</label>
        <input id="reel-comment-input" name="body" maxlength="2000" placeholder="Write a comment…" required>
        <button class="button button-primary" type="submit">Post</button>
      </form>
    </div>
  `;

  host.append(sheet);
  sheet.querySelectorAll("[data-close-sheet]").forEach((node) => {
    node.addEventListener("click", () => sheet.remove());
  });

  const list = sheet.querySelector("[data-comments-list]");
  await renderComments(list, reelId);

  sheet.querySelector("[data-comment-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const profile = await getCurrentProfile();
    if (!profile) {
      window.location.assign(loginRedirect());
      return;
    }
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const body = String(new FormData(form).get("body") || "");
    const button = form.querySelector("button[type='submit']");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await postReelComment(reelId, body);
      form.reset();
      toast("Comment posted.", "success");
      await renderComments(list, reelId);
    } catch (error) {
      toast(authErrorMessage(error), "error");
    } finally {
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });
}

/**
 * @param {Element | null} list
 * @param {string} reelId
 */
async function renderComments(list, reelId) {
  if (!(list instanceof HTMLElement)) return;
  try {
    const rows = await listReelComments(reelId);
    list.setAttribute("aria-busy", "false");
    if (!rows.length) {
      list.innerHTML = `<p class="empty">No comments yet.</p>`;
      return;
    }
    list.innerHTML = rows.map((row) => `
      <article class="reel-comment">
        <strong>${escapeHtml(row.author)}</strong>
        <p>${escapeHtml(row.body)}</p>
        <time datetime="${escapeHtml(row.created_at)}">${escapeHtml(formatWhen(row.created_at))}</time>
      </article>
    `).join("");
  } catch (error) {
    console.error("Reel comments:", error);
    list.setAttribute("aria-busy", "false");
    list.innerHTML = `<p class="empty">${escapeHtml(authErrorMessage(error))}</p>`;
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
