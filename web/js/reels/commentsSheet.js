/**
 * Comments bottom sheet for a reel.
 */

import { listReelComments, postReelComment } from "../api/reelsApi.js?v=6";
import { authErrorMessage, getCurrentProfile } from "../auth.js?v=3";
import { toast } from "../components.js?v=16";
import { escapeHtml } from "../html.js";
import { t } from "../i18n.js?v=16";
import { loginRedirect } from "../paths.js?v=4";
import { closeProductSheet } from "./productSheet.js";

/**
 * @param {HTMLElement} host
 * @param {string} reelId
 */
export async function openCommentsSheet(host, reelId) {
  closeProductSheet(host);
  host.querySelectorAll("[data-reel-sheet='comments']").forEach((node) => node.remove());

  const sheet = document.createElement("div");
  sheet.className = "reel-sheet is-bottom";
  sheet.dataset.reelSheet = "comments";
  sheet.innerHTML = `
    <div class="reel-sheet-backdrop" data-close-sheet></div>
    <div class="reel-sheet-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("comments"))}">
      <div class="reel-sheet-head">
        <h2>${escapeHtml(t("comments"))}</h2>
        <button class="icon-button reel-sheet-close" type="button" data-close-sheet aria-label="Close">×</button>
      </div>
      <div class="reel-comments" data-comments-list aria-busy="true">
        <p class="empty">${escapeHtml(t("loadingComments"))}</p>
      </div>
      <form class="reel-comment-form" data-comment-form>
        <p class="reel-reply-target" data-reply-target hidden></p>
        <input type="hidden" name="parent_id" value="">
        <label class="sr-only" for="reel-comment-input">${escapeHtml(t("addComment"))}</label>
        <input id="reel-comment-input" name="body" maxlength="2000" placeholder="${escapeHtml(t("writeComment"))}" required>
        <button class="button button-primary" type="submit">${escapeHtml(t("post"))}</button>
        <p class="reel-comment-error" data-comment-error hidden></p>
      </form>
    </div>
  `;

  host.append(sheet);
  sheet.querySelectorAll("[data-close-sheet]").forEach((node) => {
    node.addEventListener("click", () => sheet.remove());
  });

  const list = sheet.querySelector("[data-comments-list]");
  const form = sheet.querySelector("[data-comment-form]");
  form?.addEventListener("keydown", (event) => event.stopPropagation());
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const errorLine = form.querySelector("[data-comment-error]");
    const button = form.querySelector("button[type='submit']");
    const showError = (message) => {
      if (errorLine instanceof HTMLElement) {
        errorLine.hidden = false;
        errorLine.textContent = message;
      }
      toast(message, "error");
    };
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      const profile = await getCurrentProfile();
      if (!profile) {
        showError(t("commentNeedSignIn"));
        window.location.assign(loginRedirect());
        return;
      }
      const body = String(new FormData(form).get("body") || "");
      const parentId = String(new FormData(form).get("parent_id") || "") || null;
      if (errorLine instanceof HTMLElement) {
        errorLine.hidden = true;
        errorLine.textContent = "";
      }
      await postReelComment(reelId, body, parentId);
      form.reset();
      clearReply(form);
      toast(t("commentPosted"), "success");
      await renderComments(list, reelId, form);
    } catch (error) {
      console.error("Post comment:", error);
      showError(authErrorMessage(error));
    } finally {
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });

  await renderComments(list, reelId, form instanceof HTMLFormElement ? form : null);
}

/**
 * @param {Element | null} list
 * @param {string} reelId
 * @param {Element | null} form
 */
async function renderComments(list, reelId, form) {
  if (!(list instanceof HTMLElement)) return;
  try {
    const rows = await listReelComments(reelId);
    const threads = threadComments(rows);
    list.setAttribute("aria-busy", "false");
    if (!threads.length) {
      list.innerHTML = `<p class="empty">${escapeHtml(t("noComments"))}</p>`;
      return;
    }
    list.innerHTML = threads.map((row) => `
      <article class="reel-comment">
        <strong>${escapeHtml(row.author)}</strong>
        <p>${escapeHtml(row.body)}</p>
        <time datetime="${escapeHtml(row.created_at)}">${escapeHtml(formatWhen(row.created_at))}</time>
        <button class="button button-ghost" type="button" data-reply="${escapeHtml(row.id)}" data-reply-name="${escapeHtml(row.author)}">${escapeHtml(t("reply"))}</button>
        ${row.replies.map((reply) => `
          <article class="reel-comment reel-reply">
            <strong>${escapeHtml(reply.author)}</strong>
            <p>${escapeHtml(reply.body)}</p>
            <time datetime="${escapeHtml(reply.created_at)}">${escapeHtml(formatWhen(reply.created_at))}</time>
          </article>
        `).join("")}
      </article>
    `).join("");
    list.querySelectorAll("[data-reply]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!(form instanceof HTMLFormElement)) return;
        const parent = form.querySelector("[name='parent_id']");
        const input = form.querySelector("[name='body']");
        const target = form.querySelector("[data-reply-target]");
        if (parent instanceof HTMLInputElement) parent.value = button.getAttribute("data-reply") || "";
        if (input instanceof HTMLInputElement) {
          const name = button.getAttribute("data-reply-name") || "";
          input.placeholder = name ? `${t("replyTo")} ${name}` : t("writeComment");
          input.focus();
        }
        if (target instanceof HTMLElement) {
          target.hidden = false;
          const name = button.getAttribute("data-reply-name") || "";
          target.textContent = name ? `${t("replyingTo")} ${name}` : t("reply");
        }
      });
    });
  } catch (error) {
    console.error("Reel comments:", error);
    list.setAttribute("aria-busy", "false");
    list.innerHTML = `<p class="empty">${escapeHtml(authErrorMessage(error))}</p>`;
  }
}

/**
 * @param {Array<{ id: string, parentId: string | null, body: string, created_at: string, author: string }>} rows
 */
function threadComments(rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  /** @type {Map<string, typeof rows>} */
  const replies = new Map();
  const roots = [];
  for (const row of rows) {
    if (!row.parentId) {
      roots.push(row);
      continue;
    }
    let parentId = row.parentId;
    let rootId = parentId;
    const seen = new Set();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      rootId = parent.id;
      parentId = parent.parentId;
      if (!parent.parentId) rootId = parent.id;
    }
    const bucket = replies.get(rootId) || [];
    bucket.push(row);
    replies.set(rootId, bucket);
  }
  return roots.map((row) => ({ ...row, replies: replies.get(row.id) || [] }));
}

/**
 * @param {HTMLFormElement} form
 */
function clearReply(form) {
  const parent = form.querySelector("[name='parent_id']");
  const input = form.querySelector("[name='body']");
  const target = form.querySelector("[data-reply-target]");
  if (parent instanceof HTMLInputElement) parent.value = "";
  if (input instanceof HTMLInputElement) input.placeholder = t("writeComment");
  if (target instanceof HTMLElement) {
    target.hidden = true;
    target.textContent = "";
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
