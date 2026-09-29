# EME web app

Static multi-vendor marketplace front. Open it through a local web server so ES modules and Supabase can load. Do not open the HTML files directly from the file explorer.

The site is **always light**. There is no `prefers-color-scheme` dark theme. Dark backgrounds are reserved for immersive reels/live video players when those pages exist.

## Before the first run

1. Open `web/js/config.js`.
2. Replace `YOUR_SUPABASE_URL` with the project URL.
3. Replace `YOUR_SUPABASE_ANON_KEY` with the anon key (or the publishable key).
4. Leave the service role key out of this folder.

If those placeholders are still present, the home page shows a red banner and ends the skeleton loaders with a Retry button instead of hanging.

## Run

Prefer serving the `web` folder itself:

```powershell
cd web
python -m http.server 8770
```

Then open [http://localhost:8770/](http://localhost:8770/).

If you use Live Server from the repo root, open **`http://localhost:5500/web/`** (trailing slash required). A bare `/web` path breaks relative CSS and JS, so the header never injects and skeletons never finish. Pages redirect `/web` to `/web/` automatically when needed.

## Pages

### Shop

- `/` — home: categories, featured stores, top stores, trending, new arrivals, become-a-seller banner
- `/pages/shops.html` — approved store directory
- `/pages/shop.html?slug=` — storefront
- `/pages/sell.html` — Sell on EME + vendor apply form
- `/pages/categories.html` — category tree
- `/pages/products.html` — catalog filters + search (`?q=` has Products | Stores tabs)
- `/pages/product.html?slug=` — product details
- `/pages/cart.html` — cart grouped by store → checkout
- `/pages/checkout.html` — address, delivery fee, payment method UI, order summary (**does not write orders**)
- `/pages/login.html` and `/pages/register.html`

### Account (requires login, `?redirect=` on guests)

- `/pages/account/profile.html` — name, phone, avatar, password
- `/pages/account/addresses.html` — CRUD + default address
- `/pages/account/orders.html` — order list with status filter
- `/pages/account/order.html?id=` — order details + Buy again
- `/pages/wishlist.html` — wishlist inside the account layout

Full reels/live players, vendor dashboard, admin screens, and the secure `place_order` function are not built yet.

## Marketplace notes

- Shops come from `vendor_profiles` (approved only in public lists).
- Product cards show store logo + “Sold by …” linking to the storefront.
- There is **no** shop rating or verified badge column in the schema.
- Checkout `placeOrder` validates a payload and shows a friendly message. It never inserts into `orders`, `order_items`, or `payments`.
- Shipping fee comes from `platform_settings.default_shipping_fee`. There is no `shipping_methods` or `coupons` table.
- Payment method choices are UI-only (no `payment_method` enum; `payments.provider` is free text).

## Auth notes

If email confirmation is turned on in the Supabase dashboard, registration asks the person to confirm before signing in. Add `http://localhost:8770` (and your Live Server origin) to the project's redirect URLs when you use confirmation links.
