import { mountShell } from "./components.js?v=14";
import { mountReelViewer } from "./reels/reelViewer.js?v=5";
import { showState } from "./ui-state.js";
import { url } from "./paths.js?v=4";

mountShell({ page: "reels" });

window.addEventListener("beforeunload", () => {
  document.body.classList.remove("reels-lock");
  window.dispatchEvent(new Event("eme-reels-unmount"));
});

const root = document.querySelector("#reels-root");
const id = new URLSearchParams(window.location.search).get("id")
  || new URLSearchParams(window.location.search).get("start");

if (!(root instanceof HTMLElement)) {
  /* no-op */
} else if (!id) {
  showState(root, "Open a reel from the feed.", () => {
    window.location.assign(url("pages/reels.html"));
  });
} else {
  mountReelViewer(root, { startId: id });
}
