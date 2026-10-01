/**
 * Live room UI: placeholder video, chat, pinned product, products sheet.
 * Dark chrome scoped to .live-room only.
 */

import {
  getLiveStream,
  listLiveMessages,
  sendLiveMessage,
  subscribeLiveRoom,
} from "../api/liveApi.js";
import { addToCart } from "../api/cartApi.js";
import {
  followShop,
  followedShopIds,
  unfollowShop,
} from "../api/reelsApi.js";
import { authErrorMessage, getCurrentProfile } from "../auth.js";
import { toast } from "../components.js";
import { formatMoney } from "../format.js";
import { escapeHtml } from "../html.js";
import { icon } from "../icons.js";
import { loginRedirect, url } from "../paths.js";
import { shopHref, shopLogoHtml } from "../shopView.js";
import { showState } from "../ui-state.js";
import { openProductSheet } from "../reels/productSheet.js";
import { mountVideo } from "./liveVideo.js";

const MAX_BODY = 500;
const SEND_GAP_MS = 1000;

/**
 * @param {HTMLElement} root
 * @param {string} streamId
 */
export async function mountLiveRoom(root, streamId) {
  document.body.classList.add("live-lock");
  root.classList.add("live-room");
  root.innerHTML = `
    <div class="live-room-inner" aria-busy="true">
      <div class="skeleton skeleton-card live-skeleton"></div>
    </div>
  `;

  /** @type {(() => void) | null} */
  let unsubscribe = null;
  /** @type {{ destroy: () => void } | null} */
  let videoHandle = null;
  let lastSendAt = 0;
  /** @type {object | null} */
  let stream = null;

  const cleanup = () => {
    document.body.classList.remove("live-lock");
    unsubscribe?.();
    unsubscribe = null;
    videoHandle?.destroy();
    videoHandle = null;
  };

  window.addEventListener("eme-live-unmount", cleanup, { once: true });

  try {
    stream = await getLiveStream(streamId);
    if (!stream) {
      showState(root, "This live room is not available.", () => {
        window.location.assign(url("pages/lives.html"));
      });
      return;
    }

    const profile = await getCurrentProfile();
    const followed = stream.shop?.profile_id
      ? await followedShopIds([stream.shop.profile_id]).catch(() => new Set())
      : new Set();

    paint(stream, {
      following: followed.has(stream.vendorId),
      signedIn: Boolean(profile),
    });

    if (profile && (stream.status === "live" || stream.status === "ended")) {
      const messages = await listLiveMessages(stream.id).catch((error) => {
        toast(authErrorMessage(error), "error");
        return [];
      });
      for (const message of messages) appendMessage(message, false);
      scrollChatToEnd();
    }

    unsubscribe = subscribeLiveRoom(stream.id, {
      onMessage: (row) => {
        appendMessage(
          {
            id: row.id,
            body: row.body,
            created_at: row.created_at,
            user_id: row.user_id,
            author: "Customer",
          },
          true,
        );
        resolveAuthor(row.user_id, row.id);
      },
      onStreamChange: (patch) => {
        if (!stream) return;
        stream = {
          ...stream,
          status: patch.status ?? stream.status,
          pinnedProductId: patch.pinned_product_id ?? stream.pinnedProductId,
          peakViewers: patch.peak_viewers ?? stream.peakViewers,
          startedAt: patch.started_at ?? stream.startedAt,
          endedAt: patch.ended_at ?? stream.endedAt,
        };
        if (patch.pinned_product_id) {
          stream.pinnedProduct =
            stream.products.find((p) => p.id === patch.pinned_product_id) || stream.pinnedProduct;
        }
        if (patch.status === "ended" || patch.status === "removed") {
          showEndedState(stream);
        } else {
          updateStatusChrome(stream);
          renderPinned(stream);
        }
      },
    });
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, escapeHtml(message), () => mountLiveRoom(root, streamId));
  }

  /**
   * @param {object} data
   * @param {{ following: boolean, signedIn: boolean }} ui
   */
  function paint(data, ui) {
    const shop = data.shop;
    const shopLink = shop?.slug ? shopHref(shop.slug) : url("pages/shops.html");
    const back = url("pages/lives.html");

    root.innerHTML = `
      <div class="live-room-layout">
        <section class="live-stage">
          <div class="live-topbar">
            <a class="live-icon-btn" href="${back}" aria-label="Back">${icon("close")}</a>
            <a class="live-shop-chip" href="${shopLink}">
              ${shopLogoHtml(shop, "shop-logo-xs")}
              <span>${escapeHtml(shop?.shop_name || "Shop")}</span>
            </a>
            <button class="button button-ghost live-follow" type="button" data-follow aria-pressed="${ui.following ? "true" : "false"}">
              ${ui.following ? "Following" : "Follow"}
            </button>
            <span class="live-peak" data-peak ${Number(data.peakViewers) > 0 ? "" : "hidden"}>
              Peak ${escapeHtml(String(data.peakViewers || 0))}
            </span>
          </div>
          <div class="live-player" data-player></div>
          <div class="live-mobile-pin" data-pin-mobile></div>
          <div class="live-ended" data-ended hidden></div>
        </section>
        <aside class="live-side">
          <div class="live-side-pin" data-pin-desktop></div>
          <div class="live-chat" data-chat>
            <div class="live-chat-list" data-chat-list role="log" aria-live="polite"></div>
            <div class="live-chat-guest" data-chat-guest ${ui.signedIn ? "hidden" : ""}>
              <a class="button button-primary" href="${loginRedirect()}">Sign in to chat</a>
            </div>
            <form class="live-chat-form" data-chat-form ${ui.signedIn ? "" : "hidden"}>
              <label class="sr-only" for="live-chat-input">Message</label>
              <input id="live-chat-input" name="body" type="text" maxlength="${MAX_BODY}" autocomplete="off" placeholder="Say something…">
              <button class="button button-primary" type="submit">Send</button>
            </form>
            <p class="live-chat-hint" data-chat-hint hidden></p>
          </div>
          <div class="live-side-actions">
            <button class="button button-ghost" type="button" data-open-products ${data.products?.length ? "" : "disabled"}>
              Products${data.products?.length ? ` (${data.products.length})` : ""}
            </button>
          </div>
        </aside>
        <div class="live-overlays" data-overlays></div>
      </div>
    `;

    const player = root.querySelector("[data-player]");
    if (player instanceof HTMLElement) {
      videoHandle = mountVideo(player, data);
    }

    renderPinned(data);
    bindRoom(data, ui);

    if (data.status === "ended" || data.status === "removed") {
      showEndedState(data);
    } else if (data.status === "scheduled") {
      const hint = root.querySelector("[data-chat-hint]");
      if (hint) {
        hint.hidden = false;
        hint.textContent = "Chat opens when the stream goes live.";
      }
      const form = root.querySelector("[data-chat-form]");
      if (form) form.hidden = true;
    }
  }

  /**
   * @param {object} data
   * @param {{ following: boolean, signedIn: boolean }} ui
   */
  function bindRoom(data, ui) {
    const overlays = root.querySelector("[data-overlays]");

    root.querySelector("[data-follow]")?.addEventListener("click", async () => {
      const profile = await getCurrentProfile();
      if (!profile) {
        window.location.assign(loginRedirect());
        return;
      }
      const button = root.querySelector("[data-follow]");
      const following = button?.getAttribute("aria-pressed") === "true";
      try {
        if (following) {
          await unfollowShop(data.vendorId);
          button?.setAttribute("aria-pressed", "false");
          if (button) button.textContent = "Follow";
        } else {
          await followShop(data.vendorId);
          button?.setAttribute("aria-pressed", "true");
          if (button) button.textContent = "Following";
        }
      } catch (error) {
        toast(authErrorMessage(error), "error");
      }
    });

    root.querySelector("[data-open-products]")?.addEventListener("click", () => {
      if (!(overlays instanceof HTMLElement)) return;
      openProductSheet(overlays, data.products || [], { title: "Live products" });
    });

    const form = root.querySelector("[data-chat-form]");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!(form instanceof HTMLFormElement)) return;
      if (stream?.status !== "live") {
        toast("Chat is only open while the stream is live.", "info");
        return;
      }
      const input = form.querySelector("input[name=body]");
      if (!(input instanceof HTMLInputElement)) return;
      const text = input.value.trim();
      if (!text) return;
      const now = Date.now();
      if (now - lastSendAt < SEND_GAP_MS) {
        toast("Please wait a second before sending again.", "info");
        return;
      }
      lastSendAt = now;
      const submit = form.querySelector("button[type=submit]");
      if (submit instanceof HTMLButtonElement) submit.disabled = true;
      try {
        await sendLiveMessage(data.id, text);
        input.value = "";
      } catch (error) {
        toast(authErrorMessage(error), "error");
      } finally {
        if (submit instanceof HTMLButtonElement) submit.disabled = false;
      }
    });

    // Keep ui unused warning silent when guest.
    void ui;
  }

  /**
   * @param {object} data
   */
  function renderPinned(data) {
    const product = data.pinnedProduct;
    const html = product ? pinnedCardHtml(product) : "";
    root.querySelectorAll("[data-pin-mobile], [data-pin-desktop]").forEach((slot) => {
      slot.innerHTML = html;
    });

    const overlays = root.querySelector("[data-overlays]");
    root.querySelectorAll("[data-add-pinned]").forEach((button) => {
      button.addEventListener("click", () => addPinned(data));
    });
    root.querySelectorAll("[data-buy-pinned]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!(overlays instanceof HTMLElement)) return;
        openProductSheet(overlays, data.products || [], {
          title: "Buy from this live",
          buyFocus: true,
        });
      });
    });
  }

  /**
   * @param {object} data
   */
  async function addPinned(data) {
    const product = data.pinnedProduct;
    if (!product?.id) {
      toast("No pinned product yet.", "info");
      return;
    }
    try {
      const result = await addToCart(product.id, 1);
      toast(
        result.capped ? `Only ${result.stock} in stock. Added that many.` : "Added to cart.",
        result.capped ? "info" : "success",
      );
    } catch (error) {
      toast(authErrorMessage(error), "error");
    }
  }

  /**
   * @param {object} data
   */
  function updateStatusChrome(data) {
    const peak = root.querySelector("[data-peak]");
    if (peak instanceof HTMLElement) {
      if (Number(data.peakViewers) > 0) {
        peak.hidden = false;
        peak.textContent = `Peak ${data.peakViewers}`;
      } else {
        peak.hidden = true;
      }
    }
    const player = root.querySelector("[data-player]");
    if (player instanceof HTMLElement) {
      videoHandle?.destroy();
      videoHandle = mountVideo(player, data);
    }
  }

  /**
   * @param {object} data
   */
  function showEndedState(data) {
    const panel = root.querySelector("[data-ended]");
    if (!(panel instanceof HTMLElement)) return;
    panel.hidden = false;
    panel.replaceChildren();
    const box = document.createElement("div");
    box.className = "live-ended-card";
    const h = document.createElement("h2");
    h.textContent = "This live has ended";
    const p = document.createElement("p");
    p.textContent = data.title || "";
    const actions = document.createElement("div");
    actions.className = "live-ended-actions";
    const products = document.createElement("a");
    products.className = "button button-primary";
    products.href = data.shop?.slug
      ? shopHref(data.shop.slug)
      : url("pages/products.html");
    products.textContent = "Browse products";
    const reels = document.createElement("a");
    reels.className = "button button-ghost";
    reels.href = url("pages/reels.html");
    reels.textContent = "Watch reels";
    actions.append(products, reels);
    box.append(h, p, actions);
    panel.append(box);

    const form = root.querySelector("[data-chat-form]");
    if (form instanceof HTMLElement) form.hidden = true;
    const hint = root.querySelector("[data-chat-hint]");
    if (hint instanceof HTMLElement) {
      hint.hidden = false;
      hint.textContent = "Stream ended. You can still read past chat if you are signed in.";
    }
  }

  /**
   * @param {{ id: string, body: string, created_at?: string, user_id?: string, author?: string }} message
   * @param {boolean} autoscroll
   */
  function appendMessage(message, autoscroll) {
    const list = root.querySelector("[data-chat-list]");
    if (!(list instanceof HTMLElement)) return;
    if (list.querySelector(`[data-msg-id="${CSS.escape(message.id)}"]`)) return;

    const row = document.createElement("div");
    row.className = "live-chat-row";
    row.dataset.msgId = message.id;

    const author = document.createElement("strong");
    author.dataset.author = "";
    author.textContent = message.author || "Customer";

    const body = document.createElement("span");
    body.textContent = message.body || "";

    row.append(author, document.createTextNode(" "), body);
    list.append(row);
    if (autoscroll) scrollChatToEnd();
  }

  function scrollChatToEnd() {
    const list = root.querySelector("[data-chat-list]");
    if (list instanceof HTMLElement) list.scrollTop = list.scrollHeight;
  }

  /**
   * @param {string | undefined} userId
   * @param {string} messageId
   */
  async function resolveAuthor(userId, messageId) {
    if (!userId) return;
    try {
      const { getSupabase } = await import("../supabaseClient.js");
      const { data } = await getSupabase()
        .from("public_profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const name = data?.full_name;
      if (!name) return;
      const row = root.querySelector(`[data-msg-id="${CSS.escape(messageId)}"] [data-author]`);
      if (row) row.textContent = name;
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {object} product
 * @returns {string}
 */
function pinnedCardHtml(product) {
  const price = formatMoney(product.price, product.currency);
  const compare = Number(product.compare_at_price);
  const showCompare = Number.isFinite(compare) && compare > Number(product.price);
  const img = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<span class="live-pin-fallback">${escapeHtml((product.title || "?").slice(0, 1))}</span>`;
  const stock = Number(product.stock) || 0;

  return `
    <div class="live-pin-card">
      <div class="live-pin-media">${img}</div>
      <div class="live-pin-body">
        <p class="live-pin-title">${escapeHtml(product.title)}</p>
        <p class="live-pin-price">
          <strong>${escapeHtml(price)}</strong>
          ${showCompare ? `<s>${escapeHtml(formatMoney(compare, product.currency))}</s>` : ""}
        </p>
        <div class="live-pin-actions">
          <button class="button button-primary" type="button" data-buy-pinned>Buy Now</button>
          <button class="button button-ghost" type="button" data-add-pinned ${stock < 1 ? "disabled" : ""}>Add to cart</button>
        </div>
      </div>
    </div>
  `;
}
