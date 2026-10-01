/**
 * Swappable live video mount. Placeholder until LiveKit / Agora is wired.
 * Keep this the only place that touches the player DOM for a stream.
 */

/**
 * @param {HTMLElement} container
 * @param {{ id: string, title?: string, thumbnailUrl?: string, status?: string, livekitRoomName?: string }} stream
 * @returns {{ destroy: () => void }}
 */
export function mountVideo(container, stream) {
  container.replaceChildren();
  container.classList.add("live-video-root");

  const frame = document.createElement("div");
  frame.className = "live-video-placeholder";

  if (stream.thumbnailUrl) {
    const img = document.createElement("img");
    img.src = stream.thumbnailUrl;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => {
      img.hidden = true;
    };
    frame.append(img);
  }

  const badge = document.createElement("span");
  badge.className = `live-badge ${stream.status === "live" ? "is-live" : ""}`;
  badge.textContent =
    stream.status === "live" ? "LIVE" : stream.status === "scheduled" ? "UPCOMING" : "ENDED";
  frame.append(badge);

  const copy = document.createElement("div");
  copy.className = "live-video-copy";
  const title = document.createElement("p");
  title.className = "live-video-title";
  title.textContent = stream.title || "Live stream";
  const note = document.createElement("p");
  note.className = "live-video-note";
  note.textContent =
    "Stream video will appear here. LiveKit / Agora can plug into mountVideo() later.";
  copy.append(title, note);
  frame.append(copy);

  container.append(frame);

  return {
    destroy() {
      container.replaceChildren();
      container.classList.remove("live-video-root");
    },
  };
}
