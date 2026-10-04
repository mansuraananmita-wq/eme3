# EME web app

Static multi-vendor marketplace front. Open it through a local web server so ES modules and Supabase can load. Do not open the HTML files directly from the file explorer.

The site is **always light**. There is no `prefers-color-scheme` dark theme. A dark background is used only inside the immersive reels viewer (`.reels-viewer`) and live room (`.live-room`).

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

- `/` — home marketplace: hero, trust strip, categories, Flash Sale, Trending, promo banners, Live now (when any), Reels, Featured stores, New arrivals, Become a seller
- `/pages/shops.html` — approved store directory
- `/pages/shop.html?slug=` — storefront
- `/pages/sell.html` — Sell on EME + vendor apply form
- `/pages/categories.html` — category tree
- `/pages/products.html` — catalog filters + search (`?q=` has Products | Stores tabs)
- `/pages/product.html?slug=` — product details
- `/pages/cart.html` — cart grouped by store → checkout
- `/pages/checkout.html` — address, Dhaka vs outside delivery fee, COD (bKash/Nagad coming soon), `place_order` RPC
- `/pages/account/orders.html` — customer order list
- `/pages/account/order.html?id=` — order detail, timeline, cancel while pending
- `/pages/vendor-orders.html` — **approved vendors**: own line items + status transitions
- `/pages/admin.html` — **admins only** (`profiles.role = admin`): vendors, moderation, all orders
- `/pages/reels.html` — full-screen reels feed (`?start=<id>` opens at that reel)
- `/pages/reel.html?id=` — deep link into the same feed (scroll continues to next reels)
- `/pages/vendor-reels.html` — **approved vendors only**: upload, tag products, publish, delete reels
- `/pages/lives.html` — Live now + Upcoming stream cards
- `/pages/live.html?id=` — live room (video is a placeholder; chat + pinned products work)
- `/pages/login.html` and `/pages/register.html`

### Account (requires login, `?redirect=` on guests)

- `/pages/account/profile.html` — name, phone, avatar, password
- `/pages/account/addresses.html` — CRUD + default address
- `/pages/account/orders.html` — order list with status filter
- `/pages/account/order.html?id=` — order details + Buy again
- `/pages/wishlist.html` — wishlist inside the account layout

Vendor reels/orders, LiveKit/Agora players, and paid gateway webhooks are not fully productized yet. Checkout uses the `place_order` RPC (COD).

## Banners and promotions

There is **no** `banners` / `promotions` / `campaigns` table in the schema. Home ads are driven by:

- Config: [`web/js/data/banners.js`](js/data/banners.js)
- Images: [`web/assets/banners/`](assets/banners/) (SVG only)

### Add or change a banner

1. Drop an SVG (or image) into `web/assets/banners/`.
2. Open `web/js/data/banners.js`.
3. Edit `HERO_BANNERS`, `SIDE_BANNERS`, or `MEDIUM_BANNERS`. Each item needs:
   - `image` — path from `web/` (example: `assets/banners/hero-mega-sale.svg`)
   - `title` / `alt` — accessible text
   - `href` — path from `web/` (example: `pages/products.html?category=fashion`)
   - optional `start` / `end` — ISO dates; inactive rows are skipped
4. Optional: set `FLASH_SALE_ENDS` to an ISO datetime, or leave `null` for end of today.
5. Optional: edit `ANNOUNCEMENTS` (rotating top bar) and `PROMO_POPUP` (once per day on Home).

Flash Sale products use real `products.compare_at_price` discounts. The sold bar uses `sales_count` + `stock` when `sales_count > 0`.

## Marketplace notes

- Shops come from `vendor_profiles` (approved only in public lists).
- Product cards show store logo + “Sold by …” linking to the storefront.
- There is **no** shop rating or verified badge column in the schema.
- Checkout `placeOrder` validates a payload and shows a friendly message. It never inserts into `orders`, `order_items`, or `payments`.
- Shipping fee comes from `platform_settings.default_shipping_fee`. There is no `shipping_methods` or `coupons` table.
- Payment method choices are UI-only (no `payment_method` enum; `payments.provider` is free text).
- Reels: public can watch published reels of approved shops. Like / follow / comment need login. **View and share counts are not writable by the client** (trigger-guarded). Buy Now opens tagged products and uses the cart — it does not create an order.
- Reels API: `web/js/api/reelsApi.js`. Viewer: `web/js/reels/` + `web/css/reels.css`.
- Live: public can read `scheduled` / `live` / `ended` rooms of approved shops. Chat (`live_messages`) is **authenticated only** — guests see a sign-in CTA; send is allowed only while status is `live`. Pinned product uses `live_streams.pinned_product_id` (must already be in `live_stream_products`). Video is a placeholder via `web/js/live/liveVideo.js` (`mountVideo`) for a later LiveKit/Agora plug-in. Realtime watches `live_messages` inserts and `live_streams` updates. **There is no live viewer-count column** — only readable `peak_viewers` (not client-writable). Buy Now uses the shared reels product sheet → cart only.
- Live API: `web/js/api/liveApi.js`. UI: `web/js/live/` + `web/css/live.css`. List: `pages/lives.html`. Room: `pages/live.html?id=`.

## Auth notes

If email confirmation is turned on in the Supabase dashboard, registration asks the person to confirm before signing in. Add `http://localhost:8770` (and your Live Server origin) to the project's redirect URLs when you use confirmation links.
