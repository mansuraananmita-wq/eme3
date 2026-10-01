/**
 * Lucide-style inline SVG icons. currentColor follows the surrounding text.
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
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    reels: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 9.5 15 12l-5 2.5z"/>',
    share: '<circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="M8 11.2 16 6.8M8 12.8l8 4.4"/>',
    comment: '<path d="M5 6h14v9H9l-4 3z"/>',
    chevronUp: '<path d="M6 14l6-6 6 6"/>',
    chevronDown: '<path d="M6 10l6 6 6-6"/>',
    chevronLeft: '<path d="M15 6 9 12l6 6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    store: '<path d="M4 10 6 4h12l2 6"/><path d="M4 10h16v10H4z"/><path d="M9 20v-6h6v6"/>',
    package: '<path d="M12 3 20 7.5v9L12 21 4 16.5v-9z"/><path d="M12 12 20 7.5M12 12v9M12 12 4 7.5"/>',
    truck: '<path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    phone: '<path d="M8 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M10 18h4"/>',
    mail: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
    play: '<path d="M9 7.5v9l8-4.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" stroke="none"/>',
    volumeOn: '<path d="M4 10v4h3l4 3V7L7 10H4z"/><path d="M16 9a3.5 3.5 0 0 1 0 6"/><path d="M18.2 7a6 6 0 0 1 0 10"/>',
    volumeOff: '<path d="M4 10v4h3l4 3V7L7 10H4z"/><path d="M16 10l4 4M20 10l-4 4"/>',
    live: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9" opacity=".35"/>',
  };

  const body = paths[name] || paths.menu;
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}
