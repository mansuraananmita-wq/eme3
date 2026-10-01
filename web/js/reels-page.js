import { mountShell } from "./components.js";
import { mountReelViewer } from "./reels/reelViewer.js";

mountShell({ page: "reels" });

// Full-screen reels: unlock body scroll if the viewer unmounts (rare).
window.addEventListener("beforeunload", () => {
  document.body.classList.remove("reels-lock");
  window.dispatchEvent(new Event("eme-reels-unmount"));
});

const root = document.querySelector("#reels-root");
const startId = new URLSearchParams(window.location.search).get("start");

if (root instanceof HTMLElement) {
  mountReelViewer(root, { startId });
}
