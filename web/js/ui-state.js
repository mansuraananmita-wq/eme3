/**
 * Inline this logic in HTML <head> as a classic script so it runs even when module paths break.
 * Kept here as documentation of the redirect used on every page.
 *
 * if (/\/web$/i.test(location.pathname)) location.replace(location.pathname + '/' + location.search + location.hash);
 */

/**
 * Shows a fixed banner when config.js still has placeholders.
 * @param {boolean} configured
 */
export function syncConfigBanner(configured) {
  let banner = document.querySelector("#config-banner");
  if (configured) {
    banner?.remove();
    return;
  }

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "config-banner";
    banner.className = "config-banner";
    banner.setAttribute("role", "alert");
    document.body.prepend(banner);
  }

  banner.innerHTML =
    "Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in <code>web/js/config.js</code>";
}

/**
 * Shared empty / error panel that ends skeleton loaders.
 * @param {HTMLElement} root
 * @param {string} message
 * @param {() => void} [onRetry]
 */
export function showState(root, message, onRetry) {
  root.setAttribute("aria-busy", "false");
  root.innerHTML = `
    <div class="state-panel">
      <p>${message}</p>
      ${onRetry ? `<button class="button button-primary" type="button" data-retry>Retry</button>` : ""}
    </div>
  `;
  root.querySelector("[data-retry]")?.addEventListener("click", () => onRetry());
}
