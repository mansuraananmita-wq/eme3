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
  REELS_PAGE_SIZE,
  unfollowShop,
  unlikeReel,
} from "../api/reelsApi.js";
import { authErrorMessage, getCurrentProfile } from "../auth.js";
import { toast } from "../components.js";
import { escapeHtml } from "../html.js";
import { icon } from "../icons.js";
import { loginRedirect, url } from "../paths.js";
import { shopHref, shopLogoHtml } from "../shopView.js";
import { showState } from "../ui-state.js";
import { openCommentsSheet } from "./commentsSheet.js";
import { closeProductSheet, openProductSheet } from "./productSheet.js";

/**
 * @param {HTMLElement} root
 * @param {{ startId?: string | null, singleId?: string | null }} [options]
 */
export async function mountReelViewer(root, options = {}) {
  root.classList.add("reels-viewer");
  root.innerHTML = `
    <div class="reels-stage" data-stage aria-busy="true">
      <div class="skeleton skeleton-card reels-skeleton"></div>
    </div>
    <div class="reels-desktop-nav" aria-hidden="true">
      <button type="button" data-dir="-1" aria-label="Previous reel">${icon("chevronUp")}</button>
      <button type="button" data-dir="1" aria-label="Next reel">${icon("chevronDown")}</button>
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
  let muted = true;
  /** @type {IntersectionObserver | null} */
  let observer = null;
  /** @type {string | null} */
  let activeId = null;

  const singleId = options.singleId || null;
  const startId = options.startId || singleId;

  try {
    if (singleId) {
      const one = await getReel(singleId);
      if (!one) {
        showState(stage, "This reel is not available.", () => window.location.assign(url("pages/reels.html")));
        return;
      }
      reels = [one];
      total = 1;
    } else {
      const first = await listPublishedReels({ limit: REELS_PAGE_SIZE, offset: 0, sort: "newest" });
      reels = first.rows;
      total = first.total;
      if (startId && !reels.some((reel) => reel.id === startId)) {
        const focused = await getReel(startId);
        if (focused) reels = [focused, ...reels.filter((reel) => reel.id !== focused.id)];
      }
    }

    if (!reels.length) {
      showState(stage, "No reels yet. Check back soon.", () => window.location.assign(url("index.html")));
      return;
    }

    await paint();
    if (startId) scrollToReel(startId);
    else if (reels[0]) {
      activeId = reels[0].id;
      playActive();
      preloadAround(activeId);
    }
  } catch (error) {
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(stage, escapeHtml(message), () => mountReelViewer(root, options));
  }

  root.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => step(Number(button.getAttribute("data-dir"))));
  });

  document.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("eme-reels-unmount", cleanup, { once: true });

  /**
   * @param {KeyboardEvent} event
   */
  function onKey(event) {
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
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVisibility);
    observer?.disconnect();
    pauseAll();
  }

  async function paint() {
    const liked = await likedReelIds(reels.map((reel) => reel.id)).catch(() => new Set());
    const followed = await followedShopIds(
      reels.map((reel) => reel.vendorId).filter(Boolean),
    ).catch(() => new Set());

    stage.setAttribute("aria-busy", "false");
    stage.innerHTML = reels.map((reel) => slideHtml(reel, {
      liked: liked.has(reel.id),
      followed: followed.has(reel.vendorId),
      muted,
    })).join("");

    bindSlides();
    setupObserver();
    preloadAround(activeId || reels[0]?.id);
  }

  function bindSlides() {
    stage.querySelectorAll("[data-reel-id]").forEach((slide) => {
      const reelId = slide.getAttribute("data-reel-id") || "";
      const reel = reels.find((row) => row.id === reelId);
      if (!reel) return;

      const video = slide.querySelector("video");
      video?.addEventListener("timeupdate", () => updateProgress(slide, video));
      video?.addEventListener("error", () => showVideoError(slide, reel));

      slide.querySelector("[data-tap-video]")?.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("button, a")) return;
        togglePlay(video);
      });

      slide.querySelector("[data-mute]")?.addEventListener("click", () => {
        muted = !muted;
        applyMute();
      });

      slide.querySelector("[data-like]")?.addEventListener("click", () => toggleLike(reel, slide));
      slide.querySelector("[data-follow]")?.addEventListener("click", () => toggleFollow(reel, slide));
      slide.querySelector("[data-share]")?.addEventListener("click", () => shareReel(reel));
      slide.querySelector("[data-products]")?.addEventListener("click", () => {
        openProductSheet(overlays, reel.products, { title: "Shop this reel" });
      });
      slide.querySelector("[data-buy]")?.addEventListener("click", () => {
        openProductSheet(overlays, reel.products, { title: "Buy from this reel" });
      });
      slide.querySelector("[data-comments]")?.addEventListener("click", () => {
        openCommentsSheet(overlays, reel.id);
      });
      slide.querySelector("[data-caption-more]")?.addEventListener("click", (event) => {
        event.currentTarget.closest(".reel-caption")?.classList.toggle("is-expanded");
      });
      slide.querySelector("[data-retry-video]")?.addEventListener("click", () => {
        const media = slide.querySelector("video");
        if (!(media instanceof HTMLVideoElement)) return;
        slide.querySelector(".reel-video-error")?.remove();
        media.load();
        media.play().catch(() => {});
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
    const next = reels[index + 1];
    stage.querySelectorAll("video").forEach((video) => {
      if (!(video instanceof HTMLVideoElement)) return;
      const slideId = video.closest("[data-reel-id]")?.getAttribute("data-reel-id");
      if (slideId === next?.id) video.setAttribute("preload", "auto");
      else if (slideId !== id) video.setAttribute("preload", "none");
    });
  }

  /**
   * @param {string} id
   */
  async function maybeLoadMore(id) {
    if (singleId || loadingMore) return;
    const index = reels.findIndex((reel) => reel.id === id);
    if (index < reels.length - 2) return;
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
        await paint();
        if (activeId) scrollToReel(activeId);
      }
    } catch (error) {
      toast(authErrorMessage(error), "error");
    } finally {
      loadingMore = false;
    }
  }

  function playActive() {
    stage.querySelectorAll("[data-reel-id]").forEach((slide) => {
      const video = slide.querySelector("video");
      if (!(video instanceof HTMLVideoElement)) return;
      const id = slide.getAttribute("data-reel-id");
      if (id === activeId) {
        video.muted = muted;
        video.play().catch(() => {});
        slide.classList.add("is-active");
      } else {
        video.pause();
        slide.classList.remove("is-active");
      }
    });
  }

  function pauseAll() {
    stage.querySelectorAll("video").forEach((video) => {
      if (video instanceof HTMLVideoElement) video.pause();
    });
  }

  function applyMute() {
    stage.querySelectorAll("video").forEach((video) => {
      if (video instanceof HTMLVideoElement) video.muted = muted;
    });
    stage.querySelectorAll("[data-mute]").forEach((button) => {
      button.setAttribute("aria-pressed", muted ? "true" : "false");
      button.innerHTML = muted ? "Unmute" : "Mute";
    });
  }

  function togglePlayActive() {
    const slide = stage.querySelector(`[data-reel-id="${CSS.escape(activeId || "")}"]`);
    const video = slide?.querySelector("video");
    togglePlay(video);
  }

  /**
   * @param {Element | null | undefined} video
   */
  function togglePlay(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  /**
   * @param {number} delta
   */
  function step(delta) {
    const index = Math.max(0, reels.findIndex((reel) => reel.id === activeId));
    const next = reels[index + delta];
    if (next) scrollToReel(next.id);
  }

  /**
   * @param {string} id
   */
  function scrollToReel(id) {
    const slide = stage.querySelector(`[data-reel-id="${CSS.escape(id)}"]`);
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    activeId = id;
    playActive();
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
 * @param {object} reel
 * @param {{ liked: boolean, followed: boolean, muted: boolean }} state
 * @returns {string}
 */
function slideHtml(reel, state) {
  const shop = reel.shop;
  const shopLink = shop?.slug
    ? shopHref(shop.slug)
    : url("pages/products.html");
  const caption = reel.caption || "";
  const longCaption = caption.length > 90;

  return `
    <article class="reel-slide" data-reel-id="${escapeHtml(reel.id)}">
      <div class="reel-media" data-tap-video>
        <video
          playsinline
          loop
          muted
          poster="${escapeHtml(reel.thumbnailUrl || "")}"
          preload="none"
          src="${escapeHtml(reel.videoUrl || "")}"
        ></video>
        <div class="reel-progress"><span data-progress></span></div>
      </div>
      <div class="reel-ui">
        <div class="reel-shop">
          <a class="reel-shop-link" href="${shopLink}">
            ${shopLogoHtml(shop, "shop-logo-xs")}
            <span>${escapeHtml(shop?.shop_name || "Shop")}</span>
          </a>
          <button class="button button-ghost reel-follow" type="button" data-follow aria-pressed="${state.followed ? "true" : "false"}">
            ${state.followed ? "Following" : "Follow"}
          </button>
        </div>
        <p class="reel-caption ${longCaption ? "" : "is-expanded"}">
          <span>${escapeHtml(caption)}</span>
          ${longCaption ? `<button type="button" data-caption-more>more</button>` : ""}
        </p>
        <div class="reel-actions">
          <button type="button" class="${state.liked ? "is-liked" : ""}" data-like aria-pressed="${state.liked ? "true" : "false"}" aria-label="Like">
            ${icon("heart")}
            <span data-like-count>${escapeHtml(String(reel.likesCount || 0))}</span>
          </button>
          <button type="button" data-comments aria-label="Comments">
            ${icon("comment")}
            <span>${escapeHtml(String(reel.commentsCount || 0))}</span>
          </button>
          <button type="button" data-share aria-label="Share">${icon("share")}<span>Share</span></button>
          <button type="button" data-products aria-label="Products">${icon("package")}<span>Tags</span></button>
          <button type="button" data-mute aria-pressed="${state.muted ? "true" : "false"}">${state.muted ? "Unmute" : "Mute"}</button>
        </div>
        ${reel.products?.length
          ? `<button class="button button-primary reel-buy" type="button" data-buy>Buy Now</button>`
          : ""}
      </div>
    </article>
  `;
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
  panel.querySelector("[data-retry-video]")?.addEventListener("click", () => {
    panel.remove();
    const video = slide.querySelector("video");
    if (video instanceof HTMLVideoElement) {
      video.load();
      video.play().catch(() => {});
    }
  });
}

/**
 * @param {object} reel
 */
async function shareReel(reel) {
  const link = `${url("pages/reel.html")}?id=${encodeURIComponent(reel.id)}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: reel.shop?.shop_name || "EME Reel", url: link });
      return;
    }
  } catch {
    // Fall through to clipboard.
  }
  try {
    await navigator.clipboard.writeText(link);
    toast("Link copied.", "success");
  } catch {
    toast(link, "info");
  }
}
