/**
 * Editable marketplace banners and promotions.
 * There is no banners/promotions table in the schema — edit this file instead.
 *
 * Each banner:
 * - image: path under web/ (resolved via url())
 * - title / alt: accessible text
 * - href: path under web/ (pages/products.html?…, shops.html, sell.html, …)
 * - start / end: optional ISO dates; inactive banners are skipped
 */

/** End of flash sale. Null = end of local calendar day. */
export const FLASH_SALE_ENDS = null;

/** Rotating announcement messages (top bar). */
export const ANNOUNCEMENTS = [
  "Free delivery over ৳999",
  "Mega Sale up to 70% off",
  "Become a seller on EME",
];

/** Main hero carousel (3:1). */
export const HERO_BANNERS = [
  {
    id: "mega",
    image: "assets/banners/hero-mega-sale.svg",
    title: "Mega Sale up to 70% OFF",
    alt: "Mega Sale up to 70% OFF — মেগা সেল",
    href: "pages/products.html?sort=trending",
  },
  {
    id: "flash",
    image: "assets/banners/hero-flash-sale.svg",
    title: "Flash Sale ends tonight",
    alt: "Flash Sale ends tonight — আজ রাতেই শেষ",
    href: "pages/products.html?sort=trending",
  },
  {
    id: "new",
    image: "assets/banners/hero-new-arrivals.svg",
    title: "New Arrivals",
    alt: "New Arrivals — নতুন কালেকশন",
    href: "pages/products.html?sort=newest",
  },
  {
    id: "delivery",
    image: "assets/banners/hero-free-delivery.svg",
    title: "Free Delivery over ৳999",
    alt: "Free Delivery over ৳999 — ফ্রি ডেলিভারি",
    href: "pages/products.html",
  },
  {
    id: "sell",
    image: "assets/banners/hero-sell-on-eme.svg",
    title: "Sell on EME, open your store",
    alt: "Sell on EME — দোকান খুলুন",
    href: "pages/sell.html",
  },
];

/** Right column stacked promos (desktop). */
export const SIDE_BANNERS = [
  {
    id: "fashion",
    image: "assets/banners/side-fashion.svg",
    title: "Fashion Week",
    alt: "Fashion Week offers",
    href: "pages/products.html?category=fashion",
  },
  {
    id: "gadgets",
    image: "assets/banners/side-gadgets.svg",
    title: "Gadget Deals",
    alt: "Gadget Deals",
    href: "pages/products.html?category=electronics",
  },
];

/** Mid-page promo row. */
export const MEDIUM_BANNERS = [
  {
    id: "home",
    image: "assets/banners/medium-home-kitchen.svg",
    title: "Home and Kitchen offers",
    alt: "Home and Kitchen offers",
    href: "pages/products.html?category=home-and-living",
  },
  {
    id: "beauty",
    image: "assets/banners/medium-beauty.svg",
    title: "Beauty Picks",
    alt: "Beauty Picks",
    href: "pages/products.html?category=beauty",
  },
  {
    id: "kids",
    image: "assets/banners/medium-kids.svg",
    title: "Kids Corner",
    alt: "Kids Corner",
    href: "pages/products.html?category=kids-and-toys",
  },
];

/** First-visit popup (once per day). */
export const PROMO_POPUP = {
  title: "Mega Sale is live",
  body: "Save up to 70% on trending products from approved stores.",
  ctaLabel: "Shop deals",
  href: "pages/products.html?sort=trending",
  image: "assets/banners/hero-mega-sale.svg",
};

/**
 * @param {{ start?: string | null, end?: string | null }} banner
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isBannerActive(banner, now = new Date()) {
  if (banner.start) {
    const start = new Date(banner.start);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (banner.end) {
    const end = new Date(banner.end);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

/**
 * Flash sale countdown target (local end of day if FLASH_SALE_ENDS is null).
 * @returns {Date}
 */
export function flashSaleEndsAt() {
  if (FLASH_SALE_ENDS) {
    const parsed = new Date(FLASH_SALE_ENDS);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}
