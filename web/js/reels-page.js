import { mountShell } from "./components.js";
import { mountReelViewer } from "./reels/reelViewer.js";

mountShell({ page: "reels" });

const root = document.querySelector("#reels-root");
const startId = new URLSearchParams(window.location.search).get("start");

if (root instanceof HTMLElement) {
  mountReelViewer(root, { startId });
}
