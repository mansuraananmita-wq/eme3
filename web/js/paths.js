/**
 * Links that work from both web/index.html and web/pages/*.html.
 */

/**
 * True when the current page lives in web/pages/.
 * @returns {boolean}
 */
export function inPagesDir() {
  return /\/pages\//.test(window.location.pathname.replaceAll("\\", "/"));
}

/**
 * @param {string} pathFromWebRoot Path relative to the web/ folder, such as "index.html".
 * @returns {string}
 */
export function url(pathFromWebRoot) {
  return inPagesDir() ? `../${pathFromWebRoot}` : pathFromWebRoot;
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
  if (!/^[A-Za-z0-9_./?=&%-]+$/.test(next)) {
    return url("index.html");
  }
  return next;
}
