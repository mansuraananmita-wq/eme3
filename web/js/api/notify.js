/**
 * Tells the header to reload cart and wishlist counts.
 */
export function notifyCounts() {
  window.dispatchEvent(new CustomEvent("eme-counts"));
}
