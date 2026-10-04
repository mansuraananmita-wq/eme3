/**
 * Live video for a room. Connects to LiveKit when the stream status is live.
 * The API secret never reaches this file. Tokens come from the livekit-token function.
 */

import { getSupabase } from "../supabaseClient.js";

const LIVEKIT_CLIENT = "https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/+esm";

/**
 * @param {HTMLElement} container
 * @param {{ id: string, title?: string, thumbnailUrl?: string, status?: string, vendorId?: string }} stream
 * @param {{ publish?: boolean }} [options]
 * @returns {{ destroy: () => void }}
 */
export function mountVideo(container, stream, options = {}) {
  container.replaceChildren();
  container.classList.add("live-video-root");

  const frame = document.createElement("div");
  frame.className = "live-video-stage";
  paintFrame(frame, stream, statusNote(stream.status));
  container.append(frame);

  /** @type {import("https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/+esm").Room | null} */
  let room = null;
  let closed = false;

  if (stream.status === "live") {
    connect(frame, stream, Boolean(options.publish), () => closed, (next) => {
      room = next;
    }).catch((error) => {
      console.error("Live video:", error);
      if (!closed) setNote(frame, error instanceof Error ? error.message : "Live video could not start.");
    });
  }

  return {
    destroy() {
      closed = true;
      room?.disconnect();
      room = null;
      container.replaceChildren();
      container.classList.remove("live-video-root");
    },
  };
}

/**
 * @param {HTMLElement} frame
 * @param {{ id: string, title?: string, thumbnailUrl?: string, status?: string }} stream
 * @param {boolean} publish
 * @param {() => boolean} isClosed
 * @param {(room: object) => void} setRoom
 */
async function connect(frame, stream, publish, isClosed, setRoom) {
  setNote(frame, "Connecting…");
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: { stream_id: stream.id },
  });

  if (isClosed()) return;
  if (error) {
    const message = await functionError(error);
    throw new Error(message);
  }
  if (!data?.token || !data?.url) {
    throw new Error(data?.error || "Live video did not return a token.");
  }

  const { Room, RoomEvent, Track } = await import(LIVEKIT_CLIENT);
  if (isClosed()) return;

  const room = new Room();
  setRoom(room);
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (!isClosed()) attachTrack(frame, track, Track);
  });
  room.on(RoomEvent.LocalTrackPublished, (publication) => {
    if (!isClosed() && publication.track) attachTrack(frame, publication.track, Track);
  });
  room.on(RoomEvent.Disconnected, () => {
    if (!isClosed()) setNote(frame, "Disconnected from the live video.");
  });

  await room.connect(data.url, data.token);
  if (isClosed()) {
    room.disconnect();
    return;
  }

  setNote(frame, "");
  if (data.publish && publish) {
    const start = document.createElement("button");
    start.type = "button";
    start.className = "button button-primary live-cam-btn";
    start.textContent = "Start camera";
    start.addEventListener("click", async () => {
      start.disabled = true;
      try {
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
        start.hidden = true;
      } catch (cameraError) {
        console.error("Live camera:", cameraError);
        start.disabled = false;
        setNote(frame, "Allow the camera and microphone, then try again.");
      }
    });
    frame.append(start);
  } else if (!data.publish) {
    setNote(frame, "Waiting for the host camera.");
  }
}

/**
 * @param {HTMLElement} frame
 * @param {{ attach: () => HTMLMediaElement, kind: string }} track
 * @param {{ Kind: { Video: string, Audio: string } }} Track
 */
function attachTrack(frame, track, Track) {
  const element = track.attach();
  element.setAttribute("playsinline", "");
  element.autoplay = true;
  if (track.kind === Track.Kind.Video) {
    frame.querySelectorAll("video").forEach((node) => node.remove());
    frame.prepend(element);
    setNote(frame, "");
    return;
  }
  element.hidden = true;
  frame.append(element);
}

/**
 * @param {HTMLElement} frame
 * @param {{ title?: string, thumbnailUrl?: string, status?: string }} stream
 * @param {string} note
 */
function paintFrame(frame, stream, note) {
  frame.replaceChildren();
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
  badge.textContent = stream.status === "live" ? "LIVE" : stream.status === "scheduled" ? "UPCOMING" : "ENDED";
  frame.append(badge);

  const copy = document.createElement("div");
  copy.className = "live-video-copy";
  const title = document.createElement("p");
  title.className = "live-video-title";
  title.textContent = stream.title || "Live stream";
  const noteEl = document.createElement("p");
  noteEl.className = "live-video-note";
  noteEl.dataset.videoNote = "1";
  noteEl.textContent = note;
  copy.append(title, noteEl);
  frame.append(copy);
}

/**
 * @param {HTMLElement} frame
 * @param {string} text
 */
function setNote(frame, text) {
  const note = frame.querySelector("[data-video-note]");
  if (note) note.textContent = text;
  const copy = frame.querySelector(".live-video-copy");
  if (copy instanceof HTMLElement) {
    copy.hidden = text === "" && Boolean(frame.querySelector("video"));
  }
}

/**
 * @param {string | undefined} status
 * @returns {string}
 */
function statusNote(status) {
  if (status === "scheduled") return "Video starts when the host goes live.";
  if (status === "ended" || status === "removed") return "This live has ended.";
  return "";
}

/**
 * @param {{ message?: string, context?: { json?: () => Promise<{ error?: string }> } }} error
 * @returns {Promise<string>}
 */
async function functionError(error) {
  try {
    const body = await error.context?.json?.();
    if (body?.error) return body.error;
  } catch (readError) {
    console.error("Live token error body:", readError);
  }
  const raw = String(error.message || "");
  if (/failed to send|not found|404|relay|function/i.test(raw)) {
    return "Live video is not deployed yet. Schedule and Go live still work.";
  }
  return raw || "Live video is not available.";
}
