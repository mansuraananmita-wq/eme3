/**
 * Live video for a room.
 * The host camera starts as soon as the room is live.
 * LiveKit is used when the token function is configured.
 * Otherwise the host camera is sent to viewers over a direct video call.
 * The API secret never reaches this file.
 */

import { toast } from "../components.js?v=8";
import { getSupabase } from "../supabaseClient.js";

const LIVEKIT_CLIENT = "https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/+esm";
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

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
  /** @type {MediaStream | null} */
  let localMedia = null;
  /** @type {(() => void) | null} */
  let stopMesh = null;
  let closed = false;

  if (stream.status === "live") {
    begin(frame, stream, Boolean(options.publish), () => closed, {
      setRoom: (next) => {
        room = next;
      },
      setMedia: (next) => {
        localMedia = next;
      },
      setMesh: (next) => {
        stopMesh = next;
      },
    }).catch((error) => {
      console.error("Live video:", error);
      if (closed) return;
      const message = error instanceof Error ? error.message : "Live video could not start.";
      setNote(frame, message);
      toast(message, "error");
      if (!options.publish) return;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "button button-primary live-cam-btn";
      retry.textContent = "Turn camera on";
      retry.addEventListener("click", () => {
        retry.remove();
        begin(frame, stream, true, () => closed, {
          setRoom: (next) => {
            room = next;
          },
          setMedia: (next) => {
            localMedia = next;
          },
          setMesh: (next) => {
            stopMesh = next;
          },
        }).catch((retryError) => {
          console.error("Live camera:", retryError);
          const retryMessage = retryError instanceof Error ? retryError.message : "The camera did not start.";
          setNote(frame, retryMessage);
          toast(retryMessage, "error");
        });
      });
      frame.append(retry);
    });
  }

  return {
    destroy() {
      closed = true;
      room?.disconnect();
      room = null;
      stopMesh?.();
      stopMesh = null;
      localMedia?.getTracks().forEach((track) => track.stop());
      localMedia = null;
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
 * @param {{ setRoom: (room: object) => void, setMedia: (media: MediaStream | null) => void, setMesh: (stop: () => void) => void }} hooks
 */
async function begin(frame, stream, publish, isClosed, hooks) {
  if (publish) {
    const media = await openCamera();
    if (isClosed()) {
      media.getTracks().forEach((track) => track.stop());
      return;
    }
    hooks.setMedia(media);
    showMedia(frame, media, true);
  } else {
    setNote(frame, "Waiting for the host camera.");
  }

  const token = await requestToken(stream.id);
  if (isClosed()) return;

  if (token?.token && token.url) {
    try {
      await connectLiveKit(frame, token, publish, isClosed, hooks.setRoom);
      return;
    } catch (error) {
      console.error("LiveKit:", error);
    }
  }

  if (publish) {
    const media = frame.querySelector("video")?.srcObject;
    if (!(media instanceof MediaStream)) throw new Error("The camera did not start.");
    hooks.setMesh(await hostBroadcast(stream.id, media, isClosed));
    return;
  }

  hooks.setMesh(await watchBroadcast(frame, stream.id, isClosed));
}

/**
 * @param {HTMLElement} frame
 * @param {{ token: string, url: string, publish?: boolean }} token
 * @param {boolean} publish
 * @param {() => boolean} isClosed
 * @param {(room: object) => void} setRoom
 */
async function connectLiveKit(frame, token, publish, isClosed, setRoom) {
  const { Room, RoomEvent, Track } = await import(LIVEKIT_CLIENT);
  if (isClosed()) return;

  const room = new Room();
  setRoom(room);
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (!isClosed()) attachTrack(frame, track, Track);
  });
  room.on(RoomEvent.Disconnected, () => {
    if (!isClosed() && !frame.querySelector("video")) setNote(frame, "Disconnected from the live video.");
  });

  await room.connect(token.url, token.token);
  if (isClosed()) {
    room.disconnect();
    return;
  }

  if (token.publish && publish) {
    const media = frame.querySelector("video")?.srcObject;
    if (media instanceof MediaStream) {
      for (const track of media.getTracks()) {
        await room.localParticipant.publishTrack(track);
      }
    }
  }
}

/**
 * @param {string} streamId
 * @param {MediaStream} media
 * @param {() => boolean} isClosed
 * @returns {Promise<() => void>}
 */
async function hostBroadcast(streamId, media, isClosed) {
  const supabase = getSupabase();
  /** @type {Map<string, RTCPeerConnection>} */
  const peers = new Map();
  /** @type {Map<string, RTCIceCandidateInit[]>} */
  const earlyIce = new Map();
  const channel = supabase.channel(`live-cam:${streamId}`);

  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    if (isClosed() || !payload) return;
    handleHostSignal(channel, peers, earlyIce, media, payload).catch((error) => {
      console.error("Live host signal:", error);
    });
  });

  await subscribed(channel);
  return () => {
    for (const peer of peers.values()) peer.close();
    peers.clear();
    supabase.removeChannel(channel);
  };
}

/**
 * @param {object} channel
 * @param {Map<string, RTCPeerConnection>} peers
 * @param {Map<string, RTCIceCandidateInit[]>} earlyIce
 * @param {MediaStream} media
 * @param {{ kind?: string, viewerId?: string, sdp?: RTCSessionDescriptionInit, candidate?: RTCIceCandidateInit, from?: string }} payload
 */
async function handleHostSignal(channel, peers, earlyIce, media, payload) {
  const viewerId = String(payload.viewerId || "");
  if (!viewerId) return;

  if (payload.kind === "join") {
    const existing = peers.get(viewerId);
    if (existing && existing.connectionState !== "failed" && existing.connectionState !== "closed") return;
    existing?.close();

    const pc = new RTCPeerConnection(ICE);
    peers.set(viewerId, pc);
    for (const track of media.getTracks()) pc.addTrack(track, media);
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      channel.send({
        type: "broadcast",
        event: "signal",
        payload: { kind: "ice", from: "host", viewerId, candidate: event.candidate.toJSON() },
      });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await channel.send({
      type: "broadcast",
      event: "signal",
      payload: { kind: "offer", viewerId, sdp: pc.localDescription },
    });
    return;
  }

  const pc = peers.get(viewerId);
  if (!pc) return;
  if (payload.kind === "answer" && payload.sdp) {
    await pc.setRemoteDescription(payload.sdp);
    for (const candidate of earlyIce.get(viewerId) || []) {
      await pc.addIceCandidate(candidate);
    }
    earlyIce.delete(viewerId);
  }
  if (payload.kind === "ice" && payload.from === "viewer" && payload.candidate) {
    if (!pc.remoteDescription) {
      const queued = earlyIce.get(viewerId) || [];
      queued.push(payload.candidate);
      earlyIce.set(viewerId, queued);
      return;
    }
    await pc.addIceCandidate(payload.candidate);
  }
}

/**
 * @param {HTMLElement} frame
 * @param {string} streamId
 * @param {() => boolean} isClosed
 * @returns {Promise<() => void>}
 */
async function watchBroadcast(frame, streamId, isClosed) {
  const viewerId = crypto.randomUUID();
  const supabase = getSupabase();
  const pc = new RTCPeerConnection(ICE);
  /** @type {RTCIceCandidateInit[]} */
  const pendingIce = [];
  let described = false;

  pc.ontrack = (event) => {
    if (isClosed() || event.track.kind !== "video") return;
    const remote = event.streams[0];
    if (remote) showMedia(frame, remote, false);
  };

  const channel = supabase.channel(`live-cam:${streamId}`);
  channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
    if (isClosed() || !payload || payload.viewerId !== viewerId) return;
    try {
      if (payload.kind === "offer" && payload.sdp) {
        await pc.setRemoteDescription(payload.sdp);
        described = true;
        for (const candidate of pendingIce) await pc.addIceCandidate(candidate);
        pendingIce.length = 0;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await channel.send({
          type: "broadcast",
          event: "signal",
          payload: { kind: "answer", viewerId, sdp: pc.localDescription },
        });
      }
      if (payload.kind === "ice" && payload.from === "host" && payload.candidate) {
        if (!described) pendingIce.push(payload.candidate);
        else await pc.addIceCandidate(payload.candidate);
      }
    } catch (error) {
      console.error("Live viewer signal:", error);
    }
  });

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    channel.send({
      type: "broadcast",
      event: "signal",
      payload: { kind: "ice", from: "viewer", viewerId, candidate: event.candidate.toJSON() },
    });
  };

  await subscribed(channel);
  channel.send({
    type: "broadcast",
    event: "signal",
    payload: { kind: "join", viewerId },
  });

  let tries = 0;
  const joinTimer = window.setInterval(() => {
    if (isClosed() || frame.querySelector("video") || tries > 8) {
      window.clearInterval(joinTimer);
      if (!isClosed() && !frame.querySelector("video") && tries > 8) {
        setNote(frame, "The host camera has not reached this page yet.");
      }
      return;
    }
    tries += 1;
    channel.send({
      type: "broadcast",
      event: "signal",
      payload: { kind: "join", viewerId },
    });
  }, 2000);

  return () => {
    window.clearInterval(joinTimer);
    pc.close();
    supabase.removeChannel(channel);
  };
}

/**
 * @param {{ subscribe: (status: (state: string) => void) => void }} channel
 */
function subscribed(channel) {
  return new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error("The live room could not connect."));
      }
    });
  });
}

/**
 * @returns {Promise<MediaStream>}
 */
async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot open the camera.");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });
  } catch (error) {
    console.error("Camera:", error);
    throw new Error("Allow the camera and microphone, then open the live room again.");
  }
}

/**
 * @param {string} streamId
 * @returns {Promise<{ token: string, url: string, publish?: boolean } | null>}
 */
async function requestToken(streamId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: { stream_id: streamId },
  });
  if (!error && data?.token && data?.url) return data;
  if (data?.error && /not live/i.test(String(data.error))) throw new Error(String(data.error));
  const message = error ? await functionError(error) : String(data?.error || "");
  if (message && !/not configured|not deployed|not found|404|503|failed to send|relay|function/i.test(message)) {
    console.error("Live token:", message);
  }
  return null;
}

/**
 * @param {HTMLElement} frame
 * @param {MediaStream} media
 * @param {boolean} muted
 */
function showMedia(frame, media, muted) {
  frame.querySelectorAll("img").forEach((img) => {
    img.hidden = true;
  });
  const existing = frame.querySelector("video");
  if (existing instanceof HTMLVideoElement && existing.srcObject === media) return;
  const element = document.createElement("video");
  element.srcObject = media;
  element.autoplay = true;
  element.muted = muted;
  element.playsInline = true;
  element.setAttribute("playsinline", "");
  frame.querySelectorAll("video").forEach((node) => node.remove());
  frame.prepend(element);
  element.play().catch((error) => console.error("Live playback:", error));
  setNote(frame, "");
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
    if (frame.querySelector("video")) return;
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
  return String(error.message || "");
}
