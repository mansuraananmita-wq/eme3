/**
 * Inline SVG icons. Pass a name to {@link icon} or mark an element with data-icon.
 */

const PATHS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  cart: '<path d="M6.5 8h11l-.8 11H7.3L6.5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  heart: '<path d="M12 19.2S5.5 15 5.5 10.2A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 6.5 2.2c0 4.8-6.5 9-6.5 9z"/>',
  'heart-fill': '<path d="M12 19.4S5 15 5 10.1A3.8 3.8 0 0 1 12 7.6 3.8 3.8 0 0 1 19 10.1c0 4.9-7 9.3-7 9.3z"/>',
  sun: '<circle cx="12" cy="12" r="3.4"/><path d="M12 3.4v1.8M12 18.8v1.8M3.4 12h1.8M18.8 12h1.8M5.8 5.8l1.2 1.2M17 17l1.2 1.2M18.2 5.8 17 7M7 17l-1.2 1.2"/>',
  moon: '<path d="M16.2 13.4A6 6 0 0 1 10.6 4.8 6.6 6.6 0 1 0 16.2 13.4z"/>',
  user: '<circle cx="12" cy="8" r="3.1"/><path d="M5.6 19.2a6.4 6.4 0 0 1 12.8 0"/>',
  home: '<path d="m4 11 8-7 8 7"/><path d="M6.5 10.2V20h11V10.2"/>',
  shop: '<path d="M4 10h16l-1.1 9.2H5.1L4 10z"/><path d="M3.2 10 5.2 4.5h13.6L20.8 10"/><path d="M9 13.2v3.2h6v-3.2"/>',
  reels: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="m11 9 5 3-5 3V9z"/>',
  live: '<circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M7.2 8a6.6 6.6 0 0 0 0 8"/><path d="M16.8 8a6.6 6.6 0 0 1 0 8"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M5 7.5h14"/><path d="M9 7.5V5.2h6v2.3"/><path d="m7.2 7.5 1 12h7.6l1-12"/>',
  bell: '<path d="M6.4 16.2h11.2l-1.1-1.8V10a4.5 4.5 0 0 0-9 0v4.4l-1.1 1.8z"/><path d="M10 16.2a2 2 0 0 0 4 0"/>',
  sliders: '<path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2"/><circle cx="15" cy="16" r="2"/>',
  logout: '<path d="M10 7V5H5v14h5v-2"/><path d="M10 12h9"/><path d="m16 9 3 3-3 3"/>',
  package: '<path d="m3.8 8 8.2-4 8.2 4-8.2 4-8.2-4z"/><path d="M3.8 8v8L12 20l8.2-4V8"/><path d="M12 12v8"/>',
  info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  alert: '<path d="M12 4 3.4 19h17.2L12 4z"/><path d="M12 9.5v4.2"/><path d="M12 16.6h.01"/>',
  warning: '<path d="M12 4 3.4 19h17.2L12 4z"/><path d="M12 9.5v4.2"/><path d="M12 16.6h.01"/>',
  truck: '<path d="M3 7.5h10.5V16H3z"/><path d="M13.5 10.5H18l2.8 3.2V16h-7.3"/><circle cx="7" cy="17.2" r="1.4"/><circle cx="17.2" cy="17.2" r="1.4"/>',
  lock: '<rect x="5" y="11" width="14" height="8.5" rx="2"/><path d="M8 11V8.2a4 4 0 0 1 8 0V11"/>',
  eye: '<path d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.4"/>',
  message: '<path d="M5 6.2h14V15H8.2L5 17.8V6.2z"/>',
  wallet: '<rect x="3.2" y="6.5" width="17.6" height="11" rx="2"/><path d="M3.2 10.2h17.6"/><circle cx="16.2" cy="14" r="1"/>',
  shield: '<path d="M12 3.5 5.2 6.3v5.6c0 3.8 2.8 6.2 6.8 7.6 4-1.4 6.8-3.8 6.8-7.6V6.3L12 3.5z"/>',
  share: '<circle cx="6" cy="12" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="m8 11.2 7-3.2M8 12.8l7 3.2"/>',
  grid: '<rect x="4" y="4" width="6.2" height="6.2" rx="1.2"/><rect x="13.8" y="4" width="6.2" height="6.2" rx="1.2"/><rect x="4" y="13.8" width="6.2" height="6.2" rx="1.2"/><rect x="13.8" y="13.8" width="6.2" height="6.2" rx="1.2"/>',
  filter: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
  'arrow-left': '<path d="M19 12H6"/><path d="m11 7-5 5 5 5"/>',
  play: '<path d="M9 7.2v9.6l8-4.8-8-4.8z"/>',
  spark: '<path d="M12 3.2 14.2 9.8 20.8 12 14.2 14.2 12 20.8 9.8 14.2 3.2 12 9.8 9.8 12 3.2z"/>',
  'star-fill': '<path d="m12 3.4 2.2 5.3 5.7.5-4.4 3.7 1.4 5.6L12 15.8 7.1 18.5l1.4-5.6L4.1 9.2l5.7-.5L12 3.4z"/>',
  star: '<path d="m12 3.6 2.1 5.1 5.5.4-4.2 3.6 1.3 5.4L12 15.6 7.3 18.1l1.3-5.4-4.2-3.6 5.5-.4L12 3.6z"/>',
};

const FILLED = new Set(['heart-fill', 'star-fill', 'spark', 'play']);

/**
 * @param {string} name
 * @param {{ size?: number, className?: string, label?: string }} [options]
 * @returns {string}
 */
export function icon(name, options = {}) {
  const body = PATHS[name];
  if (!body) return '';

  const size = options.size ?? 24;
  const filled = FILLED.has(name);
  const className = options.className ? ` class="${options.className}"` : '';
  const a11y = options.label
    ? ` role="img" aria-label="${options.label}"`
    : ' aria-hidden="true"';
  const paint = filled
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

  return `<svg${className}${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" ${paint}>${body}</svg>`;
}

/**
 * Replaces each [data-icon] host with its SVG.
 * @param {ParentNode} [root]
 */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((host) => {
    const name = host.getAttribute('data-icon');
    const size = Number(host.getAttribute('data-icon-size') || 20);
    if (!name || !PATHS[name]) return;
    host.innerHTML = icon(name, { size });
  });
}
