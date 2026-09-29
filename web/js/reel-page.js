import { mountShell } from "./components.js";
import { mountReelViewer } from "./reels/reelViewer.js";
import { showState } from "./ui-state.js";
import { url } from "./paths.js";

mountShell({ page: "reels" });

const root = document.querySelector("#reels-root");
const id = new URLSearchParams(window.location.search).get("id");

if (!(root instanceof HTMLElement)) {
  /* no-op */
} else if (!id) {
  showState(root, "Open a reel from the feed.", () => {
    window.location.assign(url("pages/reels.html"));
  });
} else {
  mountReelViewer(root, { singleId: id, startId: id });
}
