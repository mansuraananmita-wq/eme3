/**
 * Links that work from web/index.html, web/pages/*.html, and odd Live Server URLs.
 * Built from this module's URL so they stay under /web/ even when the page path has no trailing slash.
 */

const webRoot = new URL("../", import.meta.url);

/**
 * @param {string} pathFromWebRoot Path relative to the web/ folder, such as "index.html".
 * @returns {string}
 */
export function url(pathFromWebRoot) {
  return new URL(pathFromWebRoot, webRoot).href;
}

/**
 * True when the current page lives in web/pages/.
 * @returns {boolean}
 */
export function inPagesDir() {
  return /\/pages\//.test(window.location.pathname.replaceAll("\\", "/"));
}

/**
 * Keeps post-login redirects on this site.
 * @param {string | null} next
 * @returns {string}
 */
export function safeNext(next) {
  if (!next || next.includes("://") || next.startsWith("//") || next.startsWith("/\\")) {
    return url("index.html");
  }
  if (!/^[A-Za-z0-9_./?=&%-#]+$/.test(next)) {
    return url("index.html");
  }
  const fromWebRoot = next.replace(/^\/+/, "");
  if (/^(pages\/|index\.html)/.test(fromWebRoot)) {
    return new URL(fromWebRoot, webRoot).href;
  }
  try {
    const resolved = new URL(next, window.location.href);
    if (resolved.origin !== window.location.origin) return url("index.html");
    return resolved.href;
  } catch {
    return url("index.html");
  }
}

/**
 * Login URL that returns the shopper to the current page.
 * @returns {string}
 */
export function loginRedirect() {
  const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
  return `${url("pages/login.html")}?redirect=${redirect}`;
}

/**
 * Fixes Live Server paths such as /web (no trailing slash), which break relative CSS and JS.
 * Call from a tiny inline script in every HTML file before stylesheets load.
 */
export function ensureWebTrailingSlash() {
  const path = window.location.pathname.replaceAll("\\", "/");
  if (/\/web$/i.test(path)) {
    window.location.replace(`${path}/${window.location.search}${window.location.hash}`);
  }
}
