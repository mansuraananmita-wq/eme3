import { getMyShopApplication } from "./api/shopsApi.js";
import { authErrorMessage, requireUser } from "./auth.js";
import { mountShell, toast } from "./components.js";
import { url } from "./paths.js";
import { mountVendorReelManager } from "./reels/vendorManager.js";
import { showState } from "./ui-state.js";

mountShell({ page: "reels" });

const root = document.querySelector("#vendor-reels-root");

async function boot() {
  if (!(root instanceof HTMLElement)) return;

  const profile = await requireUser();
  if (!profile) return;

  try {
    const shop = await getMyShopApplication();
    if (!shop || shop.status !== "approved") {
      root.setAttribute("aria-busy", "false");
      showState(
        root,
        "Only approved vendors can manage reels. Apply from Sell on EME and wait for approval.",
        () => window.location.assign(url("pages/sell.html")),
      );
      return;
    }

    await mountVendorReelManager(root);
  } catch (error) {
    console.error("Vendor reels page:", error);
    root.setAttribute("aria-busy", "false");
    const message = authErrorMessage(error);
    toast(message, "error");
    showState(root, message, boot);
  }
}

boot();
