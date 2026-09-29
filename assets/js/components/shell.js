import { icon } from '../core/icons.js';
import { getState, subscribe } from '../core/state.js';
import { getTheme, onThemeChange, toggleTheme } from '../core/theme.js';

const ROOT = new URL('../../../', import.meta.url);

/** @type {Record<string, string>} */
const GROUPS = {
  home: 'home',
  shop: 'shop',
  product: 'shop',
  cart: 'shop',
  checkout: 'shop',
  reels: 'reels',
  live: 'live',
  profile: 'account',
  auth: 'account',
  orders: 'account',
  vendor: 'vendor',
  admin: 'admin',
  styleguide: 'styleguide',
};

/**
 * @param {string} path
 * @returns {string}
 */
function site(path) {
  return new URL(path, ROOT).href;
}

/**
 * @returns {string}
 */
function group() {
  return GROUPS[document.body.dataset.page || ''] || '';
}

/**
 * @param {string} path
 * @param {string} label
 * @param {string} linkGroup
 * @param {string} className
 * @param {string} [iconName]
 * @returns {string}
 */
function anchor(path, label, linkGroup, className, iconName) {
  const current = linkGroup === group() ? ' aria-current="page"' : '';
  const glyph = iconName ? icon(iconName, { size: 22 }) : '';
  const text = iconName ? `<span>${label}</span>` : label;
  return `<a class="${className}" href="${site(path)}"${current}>${glyph}${text}</a>`;
}

/**
 * @param {{ title: string, label: string, links: string[][] }} column
 * @returns {string}
 */
function footerColumn(column) {
  const links = column.links
    .map(([path, label]) => `<li><a href="${site(path)}">${label}</a></li>`)
    .join('');

  return `
    <nav aria-label="${column.label}">
      <h2 class="footer-title">${column.title}</h2>
      <ul class="footer-links">${links}</ul>
    </nav>
  `;
}

/**
 * @returns {string}
 */
function renderHeader() {
  return `
    <header class="site-header">
      <nav class="nav" aria-label="Primary">
        <a class="logo" href="${site('index.html')}">
          <span class="logo-mark">${icon('spark', { size: 18 })}</span>
          <span>
            <span class="logo-word">EME</span>
            <span class="logo-tag">Marketplace</span>
          </span>
        </a>
        <div class="nav-links">
          ${anchor('pages/shop.html', 'Shop', 'shop', 'nav-link')}
          ${anchor('pages/reels.html', 'Reels', 'reels', 'nav-link')}
          ${anchor('pages/live.html', 'Live', 'live', 'nav-link')}
        </div>
        <form class="nav-search" role="search" action="${site('pages/shop.html')}" method="get">
          <label class="visually-hidden" for="site-search">Search products</label>
          <span class="nav-search-icon">${icon('search', { size: 18 })}</span>
          <input class="input" id="site-search" type="search" name="q" placeholder="Search products, shops, lives" autocomplete="off" />
        </form>
        <div class="nav-actions">
          <button type="button" class="btn btn-icon icon-wrap" aria-label="Wishlist, 0 saved" data-wishlist>
            ${icon('heart', { size: 22 })}
            <span class="count-badge" data-wishlist-count hidden>0</span>
          </button>
          <a class="btn btn-icon icon-wrap" href="${site('pages/cart.html')}" aria-label="Cart, 0 items" data-cart-link>
            ${icon('cart', { size: 22 })}
            <span class="count-badge" data-cart-count hidden>0</span>
          </a>
          <button type="button" class="btn btn-icon" data-theme-toggle aria-pressed="false" aria-label="Switch theme"></button>
          <div class="dropdown" data-dropdown>
            <button type="button" class="btn btn-icon" data-dropdown-trigger aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">
              <span class="avatar avatar-sm">G</span>
            </button>
            <div class="dropdown-menu" data-dropdown-menu role="menu" hidden>
              <p class="dropdown-label">Guest</p>
              <a class="dropdown-item" role="menuitem" href="${site('pages/auth.html')}">${icon('user', { size: 18 })} Sign in</a>
              <a class="dropdown-item" role="menuitem" href="${site('pages/profile.html')}">${icon('user', { size: 18 })} Profile</a>
              <a class="dropdown-item" role="menuitem" href="${site('pages/orders.html')}">${icon('package', { size: 18 })} Orders</a>
              <div class="dropdown-sep" role="separator"></div>
              <a class="dropdown-item" role="menuitem" href="${site('pages/vendor.html')}">${icon('shop', { size: 18 })} Vendor studio</a>
              <a class="dropdown-item" role="menuitem" href="${site('pages/admin.html')}">${icon('shield', { size: 18 })} Admin</a>
              <a class="dropdown-item" role="menuitem" href="${site('pages/styleguide.html')}">${icon('grid', { size: 18 })} Style guide</a>
            </div>
          </div>
        </div>
      </nav>
    </header>
  `;
}

/**
 * @returns {string}
 */
function renderFooter() {
  const columns = [
    {
      title: 'Marketplace',
      label: 'Marketplace',
      links: [
        ['pages/shop.html', 'Shop'],
        ['pages/product.html', 'Product'],
        ['pages/reels.html', 'Reels'],
        ['pages/live.html', 'Live'],
      ],
    },
    {
      title: 'Account',
      label: 'Account',
      links: [
        ['pages/auth.html', 'Sign in'],
        ['pages/profile.html', 'Profile'],
        ['pages/orders.html', 'Orders'],
        ['pages/cart.html', 'Cart'],
      ],
    },
    {
      title: 'Studio',
      label: 'Studio',
      links: [
        ['pages/vendor.html', 'Vendor'],
        ['pages/admin.html', 'Admin'],
        ['pages/checkout.html', 'Checkout'],
        ['pages/styleguide.html', 'Style guide'],
      ],
    },
  ];

  return `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div class="footer-brand">
          <a class="logo" href="${site('index.html')}">
            <span class="logo-mark">${icon('spark', { size: 18 })}</span>
            <span class="logo-word">EME</span>
          </a>
          <p>Multi-vendor commerce with short video and live shopping.</p>
        </div>
        ${columns.map(footerColumn).join('')}
      </div>
      <div class="container footer-bottom">
        <p>© ${new Date().getFullYear()} EME</p>
        <p>Auth and data connect through Supabase. Live video connects through LiveKit.</p>
      </div>
    </footer>
  `;
}

/**
 * @returns {string}
 */
function renderTabbar() {
  return `
    <nav class="tabbar" aria-label="Mobile">
      ${anchor('index.html', 'Home', 'home', 'tabbar-link', 'home')}
      ${anchor('pages/shop.html', 'Shop', 'shop', 'tabbar-link', 'shop')}
      ${anchor('pages/reels.html', 'Reels', 'reels', 'tabbar-link', 'reels')}
      ${anchor('pages/live.html', 'Live', 'live', 'tabbar-link', 'live')}
      ${anchor('pages/profile.html', 'Account', 'account', 'tabbar-link', 'user')}
    </nav>
  `;
}

/**
 * @param {number} count
 * @param {HTMLElement | null} badge
 */
function paintBadge(count, badge) {
  if (!badge) return;
  badge.textContent = String(count);
  badge.hidden = count < 1;
}

/**
 * @param {{ cartCount: number, wishlistCount: number }} snapshot
 */
function paintCounts(snapshot) {
  paintBadge(snapshot.cartCount, document.querySelector('[data-cart-count]'));
  paintBadge(snapshot.wishlistCount, document.querySelector('[data-wishlist-count]'));

  const cart = document.querySelector('[data-cart-link]');
  cart?.setAttribute('aria-label', `Cart, ${snapshot.cartCount} items`);

  const wishlist = document.querySelector('[data-wishlist]');
  wishlist?.setAttribute('aria-label', `Wishlist, ${snapshot.wishlistCount} saved`);
}

function bindTheme() {
  const button = document.querySelector('[data-theme-toggle]');
  if (!(button instanceof HTMLButtonElement)) return;

  /**
   * @param {'light' | 'dark'} theme
   */
  const paint = (theme) => {
    const next = theme === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${next} theme`);
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    button.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon', { size: 22 });
  };

  button.addEventListener('click', () => toggleTheme());
  onThemeChange(paint);
  paint(getTheme());
}

/**
 * Injects the shared navbar, footer, and mobile tab bar.
 */
export function mountShell() {
  const headerHost = document.getElementById('shell-header');
  if (!headerHost || headerHost.dataset.mounted === 'true') return;

  headerHost.dataset.mounted = 'true';
  headerHost.innerHTML = renderHeader();

  const footerHost = document.getElementById('shell-footer');
  if (footerHost) footerHost.innerHTML = renderFooter();

  const tabHost = document.getElementById('shell-tabbar');
  if (tabHost) tabHost.innerHTML = renderTabbar();

  bindTheme();
  paintCounts(getState());
  subscribe(paintCounts);
}
