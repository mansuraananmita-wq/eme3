/**
 * Light and dark storefront theme. Reels and live rooms keep their own dark stage.
 */

const KEY = "eme-theme";

/**
 * @returns {"light" | "dark"}
 */
export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * @param {"light" | "dark"} theme
 */
export function setTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}
