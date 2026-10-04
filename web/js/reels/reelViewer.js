/**
 * Immersive vertical reels viewer (feed or single deep link).
 * Dark chrome is scoped to .reels-viewer only — site theme stays light.
 */

import {
  followShop,
  followedShopIds,
  getReel,
  likeReel,
  likedReelIds,
  listPublishedReels,
  recordReelShare,
  recordReelView,
  REELS_PAGE_SIZE,
  saveReel,
  savedReelIds,
  unfollowShop,
  unlikeReel,
  unsaveReel,
} from "../api/reelsApi.js?v=6";
import { addToCart } from "../api/cartApi.js";
import { authErrorMessage, getCurrentProfile } from "../auth.js?v=3";
import { toast } from "../components.js?v=16";
import { formatMoney } from "../format.js";
import { escapeHtml } from "../html.js";
import { icon } from "../icons.js";
import { t } from "../i18n.js?v=15";
import { loginRedirect, url } from "../paths.js?v=4";
import { shopHref, shopLogoHtml } from "../shopView.js";
import { showState } from "../ui-state.js";
import { openCommentsSheet } from "./commentsSheet.js?v=7";
import { closeProductSheet, openProductSheet } from "./productSheet.js";

const MUTE_SESSION_KEY = "eme-reels-muted";

/**
 * @param {HTMLElement} root
 * @param {{ startId?: string | null, singleId?: string | null }} [options]
 */
export async function mountReelViewer(root, options = {}) {
  document.body.classList.add("reels-lock");
  root.classList.add("reels-viewer");
  root.innerHTML = `
    <header class="reels-topbar">
      <a class="reels-topbar-btn" href="${url("index.html")}" aria-label="Back">${icon("chevronLeft")}</a>
      <h1 class="reels-topbar-title">Reels</h1>
      <div class="reels-topbar-actions">
        <a class="reels-topbar-link" href="${url("pages/saved-reels.html")}">${escapeHtml(t("savedReels"))}</a>
        <a class="reels-topbar-link" href="${url("pages/vendor-reels.html")}">${escapeHtml(t("postReel"))}</a>
        <button class="reels-topbar-btn" type="button" data-global-mute aria-pressed="true" aria-label="Unmute">${icon("volumeOff")}</button>
      </div>
    </header>
    <div class="reels-column">
      <div class="reels-stage" data-stage aria-busy="true">
        <div class="skeleton skeleton-card reels-skeleton"></div>
      </div>
      <div class="reels-desktop-nav" aria-hidden="true">
        <button type="button" data-dir="-1" aria-label="Previous reel">${icon("chevronUp")}</button>
        <button type="button" data-dir="1" aria-label="Next reel">${icon("chevronDown")}</button>
      </div>
    </div>
    <div class="reels-overlays" data-overlays></div>
  `;

  const stage = root.querySelector("[data-stage]");
  const overlays = root.querySelector("[data-overlays]");
  if (!(stage instanceof HTMLElement) || !(overlays instanceof HTMLElement)) return;

  /** @type {Array<object>} */
  let reels = [];
  let total = 0;
  let loadingMore = false;
  let lastAppendCount = 0;
  let muted = sessionStorage.getItem(MUTE_SESSION_KEY) !== "0";
  let wheelLock = false;
  /** @type {IntersectionObserver | null} */
  let observer = null;
  /** @type {string | null} */
  let activeId = null;

  const startId = options.startId || null;

  try {
    const first = await listPublishedReels({ limit: REELS_PAGE_SIZE, offset: 0, sort: "newest" });
    reels = first.rows;
    total = first.total;

    if (startId) {
      if (!reels.some((reel) => reel.id === startId)) {
        const focused = await getReel(startId);
        if (!focused) {
          showState(stage, "This reel is not available.", () => window.location.assign(url("pages/reels.html")));
          return;
        }
        reels = [focused, ...reels.filter((reel) => reel.id !== focused.id)];
      } else {
        reels = prioritizeReel(reels, startId);
      }
    }

    if (!reels.length) {
      showState(stage, "No reels yet. Check back soon.", () => window.location.assign(url("index.html")));
      return;
    }

    await paint(false);
    applyMute();
    if (startId) scrollToReel(startId, false);
    else if (reels[0]) {
      activeId = reels[0].id;
      noteView(activeId);
      await playActive();
      preloadAround(activeId);
    }
  } catch (error) {
    console.error("Reels feed failed:", error);
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(stage, escapeHtml(message), () => mountReelViewer(root, options));
  }

  root.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => step(Number(button.getAttribute("data-dir"))));
  });

  root.querySelector("[data-global-mute]")?.addEventListener("click", () => {
    muted = !muted;
    applyMute();
  });

  stage.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) < 8) return;
      event.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      step(event.deltaY > 0 ? 1 : -1);
      window.setTimeout(() => {
        wheelLock = false;
      }, 450);
    },
    { passive: false },
  );

  document.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("eme-reels-unmount", cleanup, { once: true });

  /**
   * @param {KeyboardEvent} event
   */
  function onKey(event) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "m" || event.key === "M") {
      muted = !muted;
      applyMute();
    } else if (event.key === " ") {
      event.preventDefault();
      togglePlayActive();
    }
  }

  function onVisibility() {
    if (document.hidden) pauseAll();
    else playActive();
  }

  function cleanup() {
    document.body.classList.remove("reels-lock");
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVisibility);
    observer?.disconnect();
    pauseAll();
  }

  /**
   * @param {boolean} appendOnly
   */
  async function paint(appendOnly = false) {
    const slice = appendOnly ? reels.slice(reels.length - lastAppendCount) : reels;
    const liked = await likedReelIds(reels.map((reel) => reel.id)).catch((error) => {
      console.error("Reel likes:", error);
      return new Set();
    });
    const saved = await savedReelIds(reels.map((reel) => reel.id)).catch((error) => {
      console.error("Reel saves:", error);
      return new Set();
    });
    const followed = await followedShopIds(reels.map((reel) => reel.vendorId).filter(Boolean)).catch((error) => {
      console.error("Follow state:", error);
      return new Set();
    });

    stage.setAttribute("aria-busy", "false");
    const html = slice
      .map((reel) =>
        slideHtml(reel, {
          liked: liked.has(reel.id),
          saved: saved.has(reel.id),
          followed: followed.has(reel.vendorId),
          muted,
          eager: reel.id === activeId || reel.id === reels[0]?.id,
        }),
      )
      .join("");

    if (appendOnly) stage.insertAdjacentHTML("beforeend", html);
    else stage.innerHTML = html;

    bindSlides(appendOnly ? slice : reels);
    setupObserver();
    preloadAround(activeId || reels[0]?.id);
  }

  /**
   * @param {Array<object>} boundReels
   */
  function bindSlides(boundReels = reels) {
    boundReels.forEach((reel) => {
      const slide = stage.querySelector(`[data-reel-id="${CSS.escape(reel.id)}"]`);
      if (!slide) return;
      const video = slide.querySelector("video");
      if (video instanceof HTMLVideoElement) {
        video.muted = muted;
        video.addEventListener("timeupdate", () => updateProgress(slide, video));
        video.addEventListener("error", () => showVideoError(slide, reel));
        video.addEventListener("playing", () => {
          slide.classList.remove("is-paused", "needs-gesture");
          slide.querySelector("[data-tap-hint]")?.setAttribute("hidden", "");
        });
        video.addEventListener("pause", () => {
          if (slide.getAttribute("data-reel-id") === activeId && !video.ended) {
            slide.classList.add("is-paused");
          }
        });
      }

      slide.querySelector("[data-tap-video]")?.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("button, a, .reel-product-card")) return;
        togglePlay(video, slide);
      });

      slide.querySelector("[data-like]")?.addEventListener("click", () => toggleLike(reel, slide));
      slide.querySelector("[data-save]")?.addEventListener("click", () => toggleSave(reel, slide));
      slide.querySelector("[data-follow]")?.addEventListener("click", () => toggleFollow(reel, slide));
      slide.querySelector("[data-share]")?.addEventListener("click", () => shareReel(overlays, reel));
      slide.querySelector("[data-products]")?.addEventListener("click", () => {
        openProductSheet(overlays, reel.products, { title: "Shop this reel" });
      });
      slide.querySelector("[data-comments]")?.addEventListener("click", () => {
        openCommentsSheet(overlays, reel.id);
      });
      slide.querySelector("[data-caption-more]")?.addEventListener("click", (event) => {
        event.currentTarget.closest(".reel-caption")?.classList.toggle("is-expanded");
      });
      slide.querySelector("[data-add-cart]")?.addEventListener("click", () => addProduct(reel.products?.[0]));
      slide.querySelector("[data-buy-now]")?.addEventListener("click", () => {
        openProductSheet(overlays, reel.products, { title: "Buy from this reel", buyFocus: true });
      });
      slide.querySelector("[data-more-products]")?.addEventListener("click", () => {
        openProductSheet(overlays, reel.products, { title: "Shop this reel" });
      });
      slide.querySelector("[data-retry-video]")?.addEventListener("click", () => retryVideo(slide));
      slide.querySelector("[data-tap-hint]")?.addEventListener("click", () => {
        togglePlay(video, slide);
      });
    });
  }

  function setupObserver() {
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target) return;
        const id = visible.target.getAttribute("data-reel-id");
        if (!id || id === activeId) return;
        activeId = id;
        noteView(id);
        playActive();
        preloadAround(id);
        maybeLoadMore(id);
      },
      { root: stage, threshold: [0.6, 0.75, 0.9] },
    );

    stage.querySelectorAll("[data-reel-id]").forEach((slide) => observer?.observe(slide));
  }

  /**
   * @param {string} id
   */
  function preloadAround(id) {
    const index = reels.findIndex((reel) => reel.id === id);
    const keep = new Set(
      [index - 1, index, index + 1, index + 2]
        .filter((i) => i >= 0 && i < reels.length)
        .map((i) => reels[i]?.id)
        .filter(Boolean),
    );

    stage.querySelectorAll("video").forEach((video) => {
      if (!(video instanceof HTMLVideoElement)) return;
      const slide = video.closest("[data-reel-id]");
      const slideId = slide?.getAttribute("data-reel-id");
      if (!slideId || !video.dataset.src) return;

      if (slideId === id) {
        video.preload = "auto";
        if (!video.getAttribute("src")) video.src = video.dataset.src;
      } else if (keep.has(slideId)) {
        video.preload = slideId === reels[index + 1]?.id ? "auto" : "metadata";
        if (slideId === reels[index + 1]?.id && !video.getAttribute("src")) {
          video.src = video.dataset.src;
        }
      } else {
        video.preload = "none";
        if (video.getAttribute("src")) {
          video.pause();
          video.removeAttribute("src");
          video.load();
          slide?.classList.remove("is-active", "is-paused", "needs-gesture");
        }
      }
    });
  }

  /**
   * @param {string} id
   */
  async function maybeLoadMore(id) {
    if (loadingMore) return;
    const index = reels.findIndex((reel) => reel.id === id);
    if (index < reels.length - 3) return;
    if (reels.length >= total) return;

    loadingMore = true;
    try {
      const more = await listPublishedReels({
        limit: REELS_PAGE_SIZE,
        offset: reels.length,
        sort: "newest",
      });
      const known = new Set(reels.map((reel) => reel.id));
      const fresh = more.rows.filter((reel) => !known.has(reel.id));
      if (fresh.length) {
        reels = reels.concat(fresh);
        total = more.total;
        lastAppendCount = fresh.length;
        await paint(true);
      }
    } catch (error) {
      console.error("Reels pagination:", error);
      toast(authErrorMessage(error), "error");
    } finally {
      loadingMore = false;
    }
  }

  async function playActive() {
    stage.querySelectorAll("[data-reel-id]").forEach((slide) => {
      const video = slide.querySelector("video");
      if (!(video instanceof HTMLVideoElement)) return;
      const id = slide.getAttribute("data-reel-id");
      if (id === activeId) {
        slide.classList.add("is-active");
        video.muted = muted;
        if (!video.getAttribute("src") && video.dataset.src) {
          video.src = video.dataset.src;
        }
        const playPromise = video.play();
        if (playPromise?.then) {
          playPromise
            .then(() => {
              slide.classList.remove("needs-gesture", "is-paused");
              slide.querySelector("[data-tap-hint]")?.setAttribute("hidden", "");
            })
            .catch(() => {
              slide.classList.add("needs-gesture", "is-paused");
              const hint = slide.querySelector("[data-tap-hint]");
              if (hint) hint.removeAttribute("hidden");
            });
        }
      } else {
        video.pause();
        video.currentTime = 0;
        slide.classList.remove("is-active", "needs-gesture", "is-paused");
        slide.querySelector("[data-tap-hint]")?.setAttribute("hidden", "");
      }
    });
  }

  function pauseAll() {
    stage.querySelectorAll("video").forEach((video) => {
      if (video instanceof HTMLVideoElement) video.pause();
    });
  }

  function applyMute() {
    try {
      sessionStorage.setItem(MUTE_SESSION_KEY, muted ? "1" : "0");
    } catch (error) {
      console.error("Mute preference:", error);
    }
    stage.querySelectorAll("video").forEach((video) => {
      if (video instanceof HTMLVideoElement) video.muted = muted;
    });
    const globalMute = root.querySelector("[data-global-mute]");
    if (globalMute) {
      globalMute.setAttribute("aria-pressed", muted ? "true" : "false");
      globalMute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
      globalMute.innerHTML = muted ? icon("volumeOff") : icon("volumeOn");
    }
  }

  function togglePlayActive() {
    const slide = stage.querySelector(`[data-reel-id="${CSS.escape(activeId || "")}"]`);
    const video = slide?.querySelector("video");
    togglePlay(video, slide);
  }

  /**
   * @param {Element | null | undefined} video
   * @param {Element | null | undefined} slide
   */
  function togglePlay(video, slide) {
    if (!(video instanceof HTMLVideoElement)) return;
    if (video.paused) {
      video.muted = muted;
      video
        .play()
        .then(() => {
          slide?.classList.remove("needs-gesture", "is-paused");
          slide?.querySelector("[data-tap-hint]")?.setAttribute("hidden", "");
          flashCenterIcon(slide, "play");
        })
        .catch(() => {
          slide?.classList.add("needs-gesture");
          slide?.querySelector("[data-tap-hint]")?.removeAttribute("hidden");
        });
    } else {
      video.pause();
      slide?.classList.add("is-paused");
      flashCenterIcon(slide, "pause");
    }
  }

  /**
   * @param {number} delta
   */
  function step(delta) {
    const index = Math.max(0, reels.findIndex((reel) => reel.id === activeId));
    const next = reels[index + delta];
    if (next) scrollToReel(next.id, true);
  }

  /**
   * @param {string} id
   * @param {boolean} smooth
   */
  function scrollToReel(id, smooth) {
    const slide = stage.querySelector(`[data-reel-id="${CSS.escape(id)}"]`);
    slide?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    activeId = id;
    noteView(id);
    playActive();
    preloadAround(id);
  }

  /**
   * @param {object} reel
   * @param {Element} slide
   */
  async function toggleLike(reel, slide) {
    const profile = await getCurrentProfile();
    if (!profile) {
      window.location.assign(loginRedirect());
      return;
    }
    const button = slide.querySelector("[data-like]");
    const liked = button?.getAttribute("aria-pressed") === "true";
    try {
      if (liked) {
        await unlikeReel(reel.id);
        button?.setAttribute("aria-pressed", "false");
        button?.classList.remove("is-liked");
        reel.likesCount = Math.max(0, (reel.likesCount || 1) - 1);
      } else {
        await likeReel(reel.id);
        button?.setAttribute("aria-pressed", "true");
        button?.classList.add("is-liked");
        reel.likesCount = (reel.likesCount || 0) + 1;
      }
      const count = slide.querySelector("[data-like-count]");
      if (count) count.textContent = String(reel.likesCount);
    } catch (error) {
      toast(authErrorMessage(error), "error");
    }
  }

  /**
   * @param {object} reel
   * @param {Element} slide
   */
  async function toggleSave(reel, slide) {
    const profile = await getCurrentProfile();
    if (!profile) {
      window.location.assign(loginRedirect());
      return;
    }
    const button = slide.querySelector("[data-save]");
    const saved = button?.getAttribute("aria-pressed") === "true";
    try {
      if (saved) {
        await unsaveReel(reel.id);
        button?.setAttribute("aria-pressed", "false");
        button?.classList.remove("is-saved");
        reel.savesCount = Math.max(0, (reel.savesCount || 1) - 1);
        toast(t("reelUnsaved"), "info");
      } else {
        await saveReel(reel.id);
        button?.setAttribute("aria-pressed", "true");
        button?.classList.add("is-saved");
        reel.savesCount = (reel.savesCount || 0) + 1;
        toast(t("reelSaved"), "success");
      }
      const count = slide.querySelector("[data-save-count]");
      if (count) count.textContent = String(reel.savesCount);
    } catch (error) {
      console.error("Save reel:", error);
      toast(authErrorMessage(error), "error");
    }
  }

  /**
   * @param {string} reelId
   */
  function noteView(reelId) {
    recordReelView(reelId).catch((error) => {
      console.error("Reel view:", error);
    });
  }

  /**
   * @param {object} reel
   * @param {Element} slide
   */
  async function toggleFollow(reel, slide) {
    const profile = await getCurrentProfile();
    if (!profile) {
      window.location.assign(loginRedirect());
      return;
    }
    const button = slide.querySelector("[data-follow]");
    const following = button?.getAttribute("aria-pressed") === "true";
    try {
      if (following) {
        await unfollowShop(reel.vendorId);
        button?.setAttribute("aria-pressed", "false");
        if (button) button.textContent = "Follow";
      } else {
        await followShop(reel.vendorId);
        button?.setAttribute("aria-pressed", "true");
        if (button) button.textContent = "Following";
      }
    } catch (error) {
      toast(authErrorMessage(error), "error");
    }
  }
}

/**
 * @param {Array<object>} list
 * @param {string} id
 * @returns {Array<object>}
 */
function prioritizeReel(list, id) {
  const index = list.findIndex((reel) => reel.id === id);
  if (index <= 0) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  return [item, ...copy];
}

/**
 * @param {object} reel
 * @param {{ liked: boolean, saved?: boolean, followed: boolean, muted: boolean, eager?: boolean }} state
 * @returns {string}
 */
function slideHtml(reel, state) {
  const shop = reel.shop;
  const shopLink = shop?.slug ? shopHref(shop.slug) : url("pages/products.html");
  const caption = reel.caption || "";
  const longCaption = caption.length > 90;
  const products = reel.products || [];
  const first = products[0] || null;
  const extra = Math.max(0, products.length - 1);

  return `
    <article class="reel-slide" data-reel-id="${escapeHtml(reel.id)}">
      <div class="reel-media" data-tap-video>
        <video
          playsinline
          webkit-playsinline
          loop
          muted
          poster="${escapeHtml(reel.thumbnailUrl || first?.imageUrl || "")}"
          preload="${state.eager ? "auto" : "none"}"
          data-src="${escapeHtml(reel.videoUrl || "")}"
          ${state.eager && reel.videoUrl ? `src="${escapeHtml(reel.videoUrl)}"` : ""}
        ></video>
        ${!reel.videoUrl ? `<div class="reel-media-empty">Video unavailable</div>` : ""}
        <button class="reel-tap-hint" type="button" data-tap-hint hidden>Tap to play</button>
        <div class="reel-center-flash" data-center-flash hidden></div>
        <div class="reel-progress"><span data-progress></span></div>
      </div>

      <aside class="reel-rail" aria-label="Actions">
        <div class="reel-avatar-wrap">
          <a class="reel-avatar" href="${shopLink}" aria-label="${escapeHtml(shop?.shop_name || "Shop")}">
            ${shopLogoHtml(shop, "shop-logo")}
          </a>
          <button class="reel-follow-dot" type="button" data-follow aria-pressed="${state.followed ? "true" : "false"}" aria-label="Follow shop">
            ${state.followed ? "✓" : "+"}
          </button>
        </div>
        <button type="button" class="reel-rail-btn ${state.liked ? "is-liked" : ""}" data-like aria-pressed="${state.liked ? "true" : "false"}" aria-label="Like">
          ${icon("heart")}
          <span data-like-count>${escapeHtml(String(reel.likesCount || 0))}</span>
        </button>
        <button type="button" class="reel-rail-btn ${state.saved ? "is-saved" : ""}" data-save aria-pressed="${state.saved ? "true" : "false"}" aria-label="Save">
          ${icon("bookmark")}
          <span data-save-count>${escapeHtml(String(reel.savesCount || 0))}</span>
        </button>
        <button type="button" class="reel-rail-btn" data-comments aria-label="Comments">
          ${icon("comment")}
          <span>${escapeHtml(String(reel.commentsCount || 0))}</span>
        </button>
        <button type="button" class="reel-rail-btn" data-share aria-label="Share">
          ${icon("share")}
          <span>Share</span>
        </button>
        ${
          products.length
            ? `<button type="button" class="reel-rail-btn" data-products aria-label="Products">${icon("package")}<span>Bag</span></button>`
            : ""
        }
      </aside>

      <div class="reel-meta">
        <a class="reel-shop-name" href="${shopLink}">${escapeHtml(shop?.shop_name || "Shop")}</a>
        <p class="reel-caption ${longCaption ? "" : "is-expanded"}">
          <span>${escapeHtml(caption)}</span>
          ${longCaption ? `<button type="button" data-caption-more>more</button>` : ""}
        </p>
        ${first ? productCardHtml(first, extra) : ""}
      </div>
    </article>
  `;
}

/**
 * @param {object} product
 * @param {number} extra
 * @returns {string}
 */
function productCardHtml(product, extra) {
  const price = formatMoney(product.price, product.currency);
  const compare = Number(product.compare_at_price);
  const showCompare = Number.isFinite(compare) && compare > Number(product.price);
  const img = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<span class="reel-product-fallback">${escapeHtml((product.title || "?").slice(0, 1))}</span>`;
  const stock = Number(product.stock) || 0;

  return `
    <div class="reel-product-card">
      <div class="reel-product-card-media">${img}</div>
      <div class="reel-product-card-body">
        <p class="reel-product-card-title">${escapeHtml(product.title)}</p>
        <p class="reel-product-card-price">
          <strong>${escapeHtml(price)}</strong>
          ${showCompare ? `<s>${escapeHtml(formatMoney(compare, product.currency))}</s>` : ""}
          ${extra > 0 ? `<button type="button" class="reel-more-chip" data-more-products>+${extra} more</button>` : ""}
        </p>
        <div class="reel-product-card-actions">
          <button class="button button-primary" type="button" data-buy-now>Buy Now</button>
          <button class="button button-ghost" type="button" data-add-cart ${stock < 1 ? "disabled" : ""}>Add to cart</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * @param {object | null | undefined} product
 */
async function addProduct(product) {
  if (!product?.id) {
    toast("No product on this reel.", "info");
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
 * @param {Element} slide
 * @param {HTMLVideoElement} video
 */
function updateProgress(slide, video) {
  const bar = slide.querySelector("[data-progress]");
  if (!(bar instanceof HTMLElement) || !video.duration) return;
  bar.style.width = `${(video.currentTime / video.duration) * 100}%`;
}

/**
 * @param {Element | null | undefined} slide
 * @param {"play" | "pause"} kind
 */
function flashCenterIcon(slide, kind) {
  const flash = slide?.querySelector("[data-center-flash]");
  if (!(flash instanceof HTMLElement)) return;
  flash.innerHTML = kind === "play" ? icon("play") : icon("pause");
  flash.removeAttribute("hidden");
  flash.classList.remove("is-on");
  // Force reflow so the CSS animation restarts.
  void flash.offsetWidth;
  flash.classList.add("is-on");
  window.setTimeout(() => {
    flash.setAttribute("hidden", "");
    flash.classList.remove("is-on");
  }, 500);
}

/**
 * @param {Element} slide
 * @param {object} reel
 */
function showVideoError(slide, reel) {
  if (slide.querySelector(".reel-video-error")) return;
  const panel = document.createElement("div");
  panel.className = "reel-video-error";
  panel.innerHTML = `
    ${reel.thumbnailUrl ? `<img src="${escapeHtml(reel.thumbnailUrl)}" alt="">` : ""}
    <p>Video could not load.</p>
    <button class="button button-primary" type="button" data-retry-video>Retry</button>
  `;
  slide.querySelector(".reel-media")?.append(panel);
  panel.querySelector("[data-retry-video]")?.addEventListener("click", () => retryVideo(slide));
}

/**
 * @param {Element} slide
 */
function retryVideo(slide) {
  slide.querySelector(".reel-video-error")?.remove();
  const video = slide.querySelector("video");
  if (!(video instanceof HTMLVideoElement)) return;
  video.load();
  video.play().catch(() => {
    slide.classList.add("needs-gesture");
    slide.querySelector("[data-tap-hint]")?.removeAttribute("hidden");
  });
}

/**
 * @param {HTMLElement} host
 * @param {object} reel
 */
function shareReel(host, reel) {
  const link = new URL(`${url("pages/reel.html")}?id=${encodeURIComponent(reel.id)}`, window.location.href).href;
  host.querySelectorAll("[data-reel-sheet='share']").forEach((node) => node.remove());

  const sheet = document.createElement("div");
  sheet.className = "reel-sheet is-bottom";
  sheet.dataset.reelSheet = "share";
  const canShare = typeof navigator.share === "function";
  sheet.innerHTML = `
    <div class="reel-sheet-backdrop" data-close-sheet></div>
    <div class="reel-sheet-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("shareReel"))}">
      <div class="reel-sheet-head">
        <h2>${escapeHtml(t("shareReel"))}</h2>
        <button class="icon-button reel-sheet-close" type="button" data-close-sheet aria-label="Close">×</button>
      </div>
      <input class="reel-share-link" type="text" readonly value="${escapeHtml(link)}">
      <div class="reel-share-actions">
        <button class="button button-primary" type="button" data-copy-link>${escapeHtml(t("copyLink"))}</button>
        ${canShare ? `<button class="button button-ghost" type="button" data-native-share>${escapeHtml(t("shareReel"))}</button>` : ""}
      </div>
      <p class="reel-comment-error" data-share-note hidden></p>
    </div>
  `;
  host.append(sheet);
  sheet.querySelectorAll("[data-close-sheet]").forEach((node) => {
    node.addEventListener("click", () => sheet.remove());
  });

  const note = sheet.querySelector("[data-share-note]");
  const showNote = (message) => {
    if (!(note instanceof HTMLElement)) return;
    note.hidden = false;
    note.textContent = message;
    note.style.color = "var(--color-text)";
  };

  sheet.querySelector("[data-copy-link]")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link);
      showNote(t("reelLinkCopied"));
      recordReelShare(reel.id).catch((shareError) => console.error("Record share:", shareError));
    } catch (error) {
      console.error("Copy reel link:", error);
      const field = sheet.querySelector(".reel-share-link");
      if (field instanceof HTMLInputElement) {
        field.focus();
        field.select();
      }
    }
  });

  sheet.querySelector("[data-native-share]")?.addEventListener("click", async () => {
    try {
      await navigator.share({
        title: reel.shop?.shop_name || "EME",
        text: reel.caption || "EME reel",
        url: link,
      });
      recordReelShare(reel.id).catch((shareError) => console.error("Record share:", shareError));
      sheet.remove();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Share reel:", error);
    }
  });
}
