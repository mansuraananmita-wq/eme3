/**
 * Small inline icons. currentColor follows the surrounding text.
 * @param {string} name
 * @returns {string}
 */
export function icon(name) {
  const paths = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    cart: '<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
    heart: '<path d="M12 19s-7-4.4-7-8.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 14.6 12 19 12 19z"/>',
    user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 19.2c1.4-2.6 3.8-4 7-4s5.6 1.4 7 4"/>',
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M7 10.5V20h10v-9.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
  };

  const body = paths[name] || paths.menu;
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}
