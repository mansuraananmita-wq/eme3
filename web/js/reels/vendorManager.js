/**
 * Vendor reel upload and management (approved shops only).
 */

import {
  createReel,
  deleteReel,
  listMyProductsForReels,
  listMyReels,
  REEL_VIDEO_MAX_BYTES,
  REEL_VIDEO_MIME,
  setReelProductTags,
  updateReel,
  uploadReelThumbnail,
  uploadReelVideo,
} from "../api/reelsApi.js";
import { authErrorMessage } from "../auth.js?v=3";
import { openModal, toast } from "../components.js?v=11";
import { escapeHtml } from "../html.js";
import { url } from "../paths.js?v=4";
import { showState } from "../ui-state.js";

/**
 * @param {HTMLElement} root
 */
export async function mountVendorReelManager(root) {
  root.setAttribute("aria-busy", "true");
  root.innerHTML = `<div class="skeleton skeleton-card"></div>`;

  let products = [];
  let reels = [];

  try {
    [reels, products] = await Promise.all([listMyReels(), listMyProductsForReels()]);
  } catch (error) {
    console.error("Load vendor reels:", error);
    root.setAttribute("aria-busy", "false");
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, message, () => mountVendorReelManager(root));
    return;
  }

  render();
  root.setAttribute("aria-busy", "false");

  function render() {
    root.innerHTML = `
      <div class="vendor-reels-toolbar">
        <button class="button button-primary" type="button" data-new-reel>New reel</button>
      </div>
      <div class="vendor-reels-list" data-list>
        ${
          reels.length
            ? reels.map((reel) => reelRowHtml(reel)).join("")
            : `<p class="empty">No reels yet. Create one to get started.</p>`
        }
      </div>
      <dialog class="vendor-reel-dialog" data-editor hidden>
        <form class="vendor-reel-form" data-form>
          <header>
            <h2 data-editor-title>Edit reel</h2>
            <button class="icon-button" type="button" data-close-editor aria-label="Close">×</button>
          </header>
          <input type="hidden" name="reel_id" value="">
          <label class="field">
            <span>Caption</span>
            <textarea name="caption" rows="3" maxlength="2000" placeholder="Describe this reel…"></textarea>
          </label>
          <label class="field">
            <span>Video (MP4, WebM, MOV — max 50 MB)</span>
            <input type="file" name="video" accept="video/mp4,video/webm,video/quicktime">
            <video class="vendor-reel-preview" data-video-preview playsinline muted controls hidden></video>
            <progress class="vendor-upload-progress" data-upload-progress value="0" max="100" hidden></progress>
          </label>
          <label class="field">
            <span>Thumbnail (optional — auto from first frame when possible)</span>
            <input type="file" name="thumbnail" accept="image/jpeg,image/png,image/webp,image/gif">
            <img class="vendor-reel-thumb-preview" data-thumb-preview alt="" hidden>
          </label>
          <fieldset class="field">
            <legend>Tag products (up to 5)</legend>
            <div class="vendor-product-tags" data-product-tags>
              ${products.length ? products.map((p) => productCheckHtml(p)).join("") : `<p class="muted">No active products to tag.</p>`}
            </div>
          </fieldset>
          <label class="field">
            <span>Status</span>
            <select name="status">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <div class="vendor-reel-form-actions">
            <button class="button button-primary" type="submit">Save</button>
            <button class="button button-ghost" type="button" data-close-editor>Cancel</button>
          </div>
        </form>
      </dialog>
    `;

    root.querySelector("[data-new-reel]")?.addEventListener("click", () => openEditor(null));
    root.querySelectorAll("[data-edit-reel]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-edit-reel");
        const reel = reels.find((row) => row.id === id);
        if (reel) openEditor(reel);
      });
    });
    root.querySelectorAll("[data-delete-reel]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-delete-reel");
        if (id) confirmDelete(id);
      });
    });

    const dialog = root.querySelector("[data-editor]");
    const form = root.querySelector("[data-form]");
    root.querySelectorAll("[data-close-editor]").forEach((node) => {
      node.addEventListener("click", () => closeEditor(dialog));
    });

    form?.addEventListener("submit", (event) => onSubmit(event, dialog, form));
    form?.querySelector("[name='video']")?.addEventListener("change", (event) => onVideoPick(event, form));
  }

  /**
   * @param {object | null} reel
   */
  function openEditor(reel) {
    const dialog = root.querySelector("[data-editor]");
    const form = root.querySelector("[data-form]");
    if (!(dialog instanceof HTMLDialogElement) || !(form instanceof HTMLFormElement)) return;

    form.reset();
    form.querySelector("[name='reel_id']").value = reel?.id || "";
    form.querySelector("[data-editor-title]").textContent = reel ? "Edit reel" : "New reel";
    const captionInput = form.querySelector("[name='caption']");
    if (captionInput instanceof HTMLTextAreaElement && reel?.caption) captionInput.value = reel.caption;
    const statusSelect = form.querySelector("[name='status']");
    if (statusSelect instanceof HTMLSelectElement) {
      statusSelect.value = reel?.status === "published" ? "published" : "draft";
    }

    const videoPreview = form.querySelector("[data-video-preview]");
    if (videoPreview instanceof HTMLVideoElement) {
      if (reel?.videoUrl) {
        videoPreview.src = reel.videoUrl;
        videoPreview.hidden = false;
      } else {
        videoPreview.removeAttribute("src");
        videoPreview.hidden = true;
      }
    }

    const thumbPreview = form.querySelector("[data-thumb-preview]");
    if (thumbPreview instanceof HTMLImageElement) {
      if (reel?.thumbnailUrl) {
        thumbPreview.src = reel.thumbnailUrl;
        thumbPreview.hidden = false;
      } else {
        thumbPreview.hidden = true;
      }
    }

    form.querySelectorAll("[data-product-tags] input[type='checkbox']").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.checked = reel?.productIds?.includes(input.value) ?? false;
    });

    dialog.hidden = false;
    dialog.showModal();
  }

  /**
   * @param {HTMLDialogElement | null} dialog
   */
  function closeEditor(dialog) {
    if (dialog instanceof HTMLDialogElement) {
      dialog.close();
      dialog.hidden = true;
    }
  }

  /**
   * @param {Event} event
   * @param {HTMLDialogElement | null} dialog
   * @param {HTMLFormElement} form
   */
  async function onSubmit(event, dialog, form) {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    if (submit instanceof HTMLButtonElement) submit.disabled = true;

    const fd = new FormData(form);
    let reelId = String(fd.get("reel_id") || "").trim();
    const caption = String(fd.get("caption") || "").trim();
    const status = fd.get("status") === "published" ? "published" : "draft";
    const videoFile = fd.get("video");
    const thumbFile = fd.get("thumbnail");
    const productIds = [...form.querySelectorAll("[data-product-tags] input:checked")].map((el) =>
      el instanceof HTMLInputElement ? el.value : "",
    ).filter(Boolean);

    const progress = form.querySelector("[data-upload-progress]");

    try {
      if (!reelId) {
        reelId = await createReel({ caption, status: "draft" });
      }

      if (videoFile instanceof File && videoFile.size > 0) {
        if (progress instanceof HTMLProgressElement) {
          progress.hidden = false;
          progress.value = 0;
        }
        await uploadReelVideo(reelId, videoFile, (pct) => {
          if (progress instanceof HTMLProgressElement) progress.value = pct;
        });
        if (progress instanceof HTMLProgressElement) progress.hidden = true;
      }

      if (status === "published") {
        const existing = reels.find((row) => row.id === reelId);
        const hasVideo =
          (videoFile instanceof File && videoFile.size > 0) ||
          Boolean(existing?.videoPath || existing?.videoUrl);
        if (!hasVideo) throw new Error("Add a video before publishing.");
      }

      await updateReel(reelId, { caption: caption || null, status });
      await setReelProductTags(reelId, productIds);

      if (thumbFile instanceof File && thumbFile.size > 0) {
        await uploadReelThumbnail(reelId, thumbFile);
      } else if (videoFile instanceof File && videoFile.size > 0) {
        const generated = await captureVideoPoster(form.querySelector("[data-video-preview]"));
        if (generated) {
          const file = new File([generated], "thumb.jpg", { type: "image/jpeg" });
          await uploadReelThumbnail(reelId, file);
        }
      }

      toast("Reel saved.", "success");
      closeEditor(dialog instanceof HTMLDialogElement ? dialog : null);
      reels = await listMyReels();
      render();
    } catch (error) {
      console.error("Save reel:", error);
      toast(authErrorMessage(error), "error");
    } finally {
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
      if (progress instanceof HTMLProgressElement) progress.hidden = true;
    }
  }

  /**
   * @param {Event} event
   * @param {HTMLFormElement} form
   */
  function onVideoPick(event, form) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    const file = input.files[0];
    if (!REEL_VIDEO_MIME.includes(file.type)) {
      toast("Use an MP4, WebM, or MOV file.", "error");
      input.value = "";
      return;
    }
    if (file.size > REEL_VIDEO_MAX_BYTES) {
      toast("Video must be 50 MB or smaller.", "error");
      input.value = "";
      return;
    }

    const preview = form.querySelector("[data-video-preview]");
    if (preview instanceof HTMLVideoElement) {
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
      preview.onloadeddata = () => {
        captureVideoPoster(preview).then((blob) => {
          if (!blob) return;
          const img = form.querySelector("[data-thumb-preview]");
          if (img instanceof HTMLImageElement) {
            img.src = URL.createObjectURL(blob);
            img.hidden = false;
          }
        });
      };
    }
  }

  /**
   * @param {string} reelId
   */
  function confirmDelete(reelId) {
    openModal({
      title: "Delete reel",
      body: "This removes the reel from your shop feed. This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await deleteReel(reelId);
          toast("Reel deleted.", "success");
          reels = reels.filter((row) => row.id !== reelId);
          render();
        } catch (error) {
          console.error("Delete reel:", error);
          toast(authErrorMessage(error), "error");
        }
      },
    });
  }
}

/**
 * @param {object} reel
 * @returns {string}
 */
function reelRowHtml(reel) {
  const thumb = reel.thumbnailUrl || reel.videoUrl || "";
  const watch =
    reel.status === "published"
      ? `<a class="button button-ghost" href="${url("pages/reel.html")}?id=${encodeURIComponent(reel.id)}">View</a>`
      : "";

  return `
    <article class="vendor-reel-row">
      <div class="vendor-reel-row-media">
        ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : `<span class="reel-product-fallback">Vid</span>`}
      </div>
      <div class="vendor-reel-row-body">
        <p><strong>${escapeHtml(reel.caption || "Untitled reel")}</strong></p>
        <p class="muted">${escapeHtml(reel.status)} · ${escapeHtml(String(reel.likesCount || 0))} likes</p>
        <div class="vendor-reel-row-actions">
          <button class="button button-ghost" type="button" data-edit-reel="${escapeHtml(reel.id)}">Edit</button>
          ${watch}
          <button class="button button-ghost" type="button" data-delete-reel="${escapeHtml(reel.id)}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

/**
 * @param {{ id: string, title: string }} product
 * @returns {string}
 */
function productCheckHtml(product) {
  return `
    <label class="vendor-product-check">
      <input type="checkbox" name="products" value="${escapeHtml(product.id)}">
      <span>${escapeHtml(product.title)}</span>
    </label>
  `;
}

/**
 * @param {Element | null} videoEl
 * @returns {Promise<Blob | null>}
 */
async function captureVideoPoster(videoEl) {
  if (!(videoEl instanceof HTMLVideoElement) || !videoEl.videoWidth) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85));
  } catch (error) {
    console.error("Thumbnail capture:", error);
    return null;
  }
}
