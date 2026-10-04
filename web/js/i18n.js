/**
 * Bangla and English copy for the storefront.
 * Product titles and shop names stay as stored in the database.
 */

const KEY = "eme-lang";

/** @type {Record<string, Record<string, string>>} */
const STRINGS = {
  en: {
    trackOrder: "Track order",
    sellOnEme: "Sell on EME",
    help: "Help",
    language: "Language",
    theme: "Theme",
    themeDark: "Dark",
    themeLight: "Light",
    all: "All",
    searchProducts: "Search products",
    searchInEme: "Search in EME",
    search: "Search",
    wishlist: "Wishlist",
    cart: "Cart",
    login: "Login",
    register: "Register",
    allCategories: "All categories",
    stores: "Stores",
    reels: "Reels",
    live: "Live",
    home: "Home",
    account: "Account",
    browseStores: "Browse stores",
    about: "eme is a multi-vendor marketplace for everyday shopping in Bangladesh.",
    customerService: "Customer service",
    yourCart: "Your cart",
    browseProducts: "Browse products",
    sellBlurb: "Open a shop and reach customers with products, reels, and live selling.",
    sellerLanding: "Seller landing",
    applyToSell: "Apply to sell",
    createAccount: "Create account",
    contact: "Contact",
    cod: "Cash on delivery",
    addToCart: "Add to cart",
    buyNow: "Buy Now",
    messageShop: "Message shop",
    save: "Save",
    inStock: "In stock",
    outOfStock: "Out of stock",
    noDescription: "No description yet.",
    reviews: "reviews",
    average: "average",
    quantity: "Quantity",
    decrease: "Decrease quantity",
    increase: "Increase quantity",
    productDetails: "Product details",
    description: "Description",
    shopByCategory: "Shop by category",
    flashSale: "Flash Sale",
    trending: "Trending",
    liveNow: "Live now",
    featuredStores: "Featured stores",
    newArrivals: "New arrivals",
    becomeSeller: "Become a seller",
    profile: "Profile",
    addresses: "Addresses",
    orders: "Orders",
    following: "Following",
    transactions: "Transactions",
    logout: "Logout",
    signOut: "Sign out",
    noTransactions: "No payments yet. Cash on delivery is recorded when you place an order.",
    startShopping: "Start shopping",
    provider: "Method",
    amount: "Amount",
    status: "Status",
    date: "Date",
    order: "Order",
    reference: "Reference",
    myAccount: "My account",
    admin: "Admin",
    messages: "Messages",
    vendorStudio: "Vendor studio",
    startLive: "Start live",
    shopOrders: "Shop orders",
    yourReels: "Your reels",
  },
  bn: {
    trackOrder: "অর্ডার ট্র্যাক",
    sellOnEme: "EME-তে বিক্রি করুন",
    help: "সাহায্য",
    language: "ভাষা",
    theme: "থিম",
    themeDark: "ডার্ক",
    themeLight: "লাইট",
    all: "সব",
    searchProducts: "পণ্য খুঁজুন",
    searchInEme: "EME-তে খুঁজুন",
    search: "খুঁজুন",
    wishlist: "পছন্দের তালিকা",
    cart: "কার্ট",
    login: "লগইন",
    register: "রেজিস্টার",
    allCategories: "সব ক্যাটাগরি",
    stores: "দোকান",
    reels: "রিলস",
    live: "লাইভ",
    home: "হোম",
    account: "অ্যাকাউন্ট",
    browseStores: "দোকান দেখুন",
    about: "eme বাংলাদেশের দৈনন্দিন কেনাকাটার মাল্টি-ভেন্ডর মার্কেটপ্লেস।",
    customerService: "কাস্টমার সার্ভিস",
    yourCart: "আপনার কার্ট",
    browseProducts: "পণ্য দেখুন",
    sellBlurb: "দোকান খুলে পণ্য, রিলস ও লাইভ দিয়ে ক্রেতার কাছে পৌঁছান।",
    sellerLanding: "বিক্রেতা পাতা",
    applyToSell: "বিক্রি করতে আবেদন",
    createAccount: "অ্যাকাউন্ট খুলুন",
    contact: "যোগাযোগ",
    cod: "ক্যাশ অন ডেলিভারি",
    addToCart: "কার্টে যোগ করুন",
    buyNow: "এখনই কিনুন",
    messageShop: "দোকানকে মেসেজ",
    save: "সেভ",
    inStock: "স্টকে আছে",
    outOfStock: "স্টক শেষ",
    noDescription: "এখনো বিবরণ নেই।",
    reviews: "রিভিউ",
    average: "গড়",
    quantity: "পরিমাণ",
    decrease: "কমান",
    increase: "বাড়ান",
    productDetails: "পণ্যের বিবরণ",
    description: "বিবরণ",
    shopByCategory: "ক্যাটাগরি অনুযায়ী",
    flashSale: "ফ্ল্যাশ সেল",
    trending: "ট্রেন্ডিং",
    liveNow: "এখন লাইভ",
    featuredStores: "বাছাই করা দোকান",
    newArrivals: "নতুন পণ্য",
    becomeSeller: "বিক্রেতা হোন",
    profile: "প্রোফাইল",
    addresses: "ঠিকানা",
    orders: "অর্ডার",
    following: "ফলোইং",
    transactions: "লেনদেন",
    logout: "লগআউট",
    signOut: "সাইন আউট",
    noTransactions: "এখনো কোনো পেমেন্ট নেই। অর্ডার দিলে ক্যাশ অন ডেলিভারি এখানে দেখা যাবে।",
    startShopping: "কেনাকাটা শুরু",
    provider: "মাধ্যম",
    amount: "টাকা",
    status: "অবস্থা",
    date: "তারিখ",
    order: "অর্ডার",
    reference: "রেফারেন্স",
    myAccount: "আমার অ্যাকাউন্ট",
    admin: "অ্যাডমিন",
    messages: "মেসেজ",
    vendorStudio: "ভেন্ডর স্টুডিও",
    startLive: "লাইভ শুরু",
    shopOrders: "দোকানের অর্ডার",
    yourReels: "আপনার রিলস",
  },
};

/**
 * @returns {"en" | "bn"}
 */
export function getLang() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "bn" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  return "en";
}

/**
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  const lang = getLang();
  return STRINGS[lang][key] || STRINGS.en[key] || key;
}

/**
 * @param {"en" | "bn"} lang
 */
export function setLang(lang) {
  const next = lang === "bn" ? "bn" : "en";
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next;
}

/**
 * Fills elements marked with data-i18n, data-i18n-placeholder, or data-i18n-aria.
 * @param {ParentNode} [root]
 */
export function applyI18n(root = document) {
  document.documentElement.lang = getLang();
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (key) node.textContent = t(key);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (key && "placeholder" in node) node.placeholder = t(key);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria");
    if (key) node.setAttribute("aria-label", t(key));
  });
}
