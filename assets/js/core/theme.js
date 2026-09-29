/**
 * Theme preference. The storage key must match the inline script in every HTML page.
 * That script applies the theme before first paint. This module owns toggles after load.
 */

const STORAGE_KEY = 'eme-theme';

/**
 * @returns {'light' | 'dark'}
 */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * @param {'light' | 'dark'} theme
 */
function paint(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B0B12' : '#F8F9FC');

  document.dispatchEvent(new CustomEvent('eme:theme', { detail: { theme } }));
}

/**
 * @param {'light' | 'dark'} theme
 * @param {{ persist?: boolean }} [options]
 */
export function applyTheme(theme, options = {}) {
  if (theme !== 'light' && theme !== 'dark') return;
  paint(theme);
  if (options.persist === false) return;

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* Private mode can block storage. The attribute still updates. */
  }
}

/**
 * @returns {'light' | 'dark'}
 */
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/**
 * Follows the OS theme until the shopper picks one.
 */
export function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }

  if (stored === 'light' || stored === 'dark') return;

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', (event) => {
    applyTheme(event.matches ? 'dark' : 'light', { persist: false });
  });
}

/**
 * @param {(theme: 'light' | 'dark') => void} listener
 * @returns {() => void}
 */
export function onThemeChange(listener) {
  const handler = (event) => listener(event.detail.theme);
  document.addEventListener('eme:theme', handler);
  return () => document.removeEventListener('eme:theme', handler);
}
