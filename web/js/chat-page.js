import {
  getConversation,
  listMessages,
  markThreadRead,
  openCustomerThread,
  sendMessage,
} from "./api/vendorApi.js";
import { authErrorMessage, getCurrentProfile, requireUser } from "./auth.js?v=3";
import { mountShell, toast } from "./components.js?v=6";
import { escapeHtml } from "./html.js";
import { url } from "./paths.js?v=4";
import { showState } from "./ui-state.js";

mountShell({ page: "account" });

const root = document.querySelector("#chat-root");

async function boot() {
  if (!(root instanceof HTMLElement)) return;
  const profile = await requireUser();
  if (!profile) return;

  const params = new URLSearchParams(window.location.search);
  let id = params.get("id");
  const shopId = params.get("shop");
  const productId = params.get("product");

  try {
    if (!id && shopId) {
      id = await openCustomerThread(shopId, productId);
      window.history.replaceState(null, "", `${url("pages/chat.html")}?id=${encodeURIComponent(id)}`);
    }
    if (!id) {
      root.setAttribute("aria-busy", "false");
      root.innerHTML = `
        <div class="account-card">
          <p>Open a product and choose Message shop, or open a thread from Vendor studio.</p>
          <a class="button button-ghost" href="${url("pages/products.html")}">Browse products</a>
        </div>
      `;
      return;
    }
    await renderThread(profile.id, id);
  } catch (error) {
    console.error("Chat:", error);
    root.setAttribute("aria-busy", "false");
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, message, boot);
  }
}

/**
 * @param {string} userId
 * @param {string} conversationId
 */
async function renderThread(userId, conversationId) {
  if (!(root instanceof HTMLElement)) return;
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    root.setAttribute("aria-busy", "false");
    showState(root, "This conversation is not available.");
    return;
  }
  await markThreadRead(conversationId);
  const messages = await listMessages(conversationId);
  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <div class="account-card chat-thread">
      <h2>${escapeHtml(conversation.otherName)}</h2>
      <div class="chat-log" id="chat-log">
        ${messages.map((message) => `
          <p class="chat-bubble ${message.sender_id === userId ? "is-mine" : ""}">${escapeHtml(message.body)}</p>
        `).join("") || `<p class="muted">No messages yet.</p>`}
      </div>
      <form id="chat-form" class="chat-form">
        <label class="sr-only" for="chat-body">Message</label>
        <textarea id="chat-body" name="body" rows="3" maxlength="4000" required placeholder="Write a message"></textarea>
        <button class="button button-primary" type="submit">Send</button>
      </form>
    </div>
  `;
  const log = root.querySelector("#chat-log");
  if (log instanceof HTMLElement) log.scrollTop = log.scrollHeight;
  root.querySelector("#chat-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const body = String(new FormData(form).get("body") || "");
    const button = form.querySelector("button");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await sendMessage(conversationId, body);
      const profile = await getCurrentProfile();
      if (profile) await renderThread(profile.id, conversationId);
    } catch (error) {
      console.error("Send message:", error);
      toast(authErrorMessage(error), "error");
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });
}

boot();
