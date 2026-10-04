import { mountShell } from "./components.js?v=6";
import { mountLiveRoom } from "./live/liveRoom.js?v=3";
import { showState } from "./ui-state.js";
import { url } from "./paths.js?v=4";

mountShell({ page: "lives" });

window.addEventListener("beforeunload", () => {
  document.body.classList.remove("live-lock");
  window.dispatchEvent(new Event("eme-live-unmount"));
});

const root = document.querySelector("#live-root");
const id = new URLSearchParams(window.location.search).get("id");

if (!(root instanceof HTMLElement)) {
  /* no-op */
} else if (!id) {
  showState(root, "Pick a live room from the list.", () => {
    window.location.assign(url("pages/lives.html"));
  });
} else {
  mountLiveRoom(root, id);
}
