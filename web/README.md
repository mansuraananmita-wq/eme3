# EME web app

Static multi-vendor marketplace. Open it through a local web server so ES modules and Supabase can load. Do not open the HTML files directly from the file explorer.

The storefront has a light theme and a dark theme. The choice is saved in the browser (`eme-theme`). The top bar **Dark / Light** button switches it. Reels and live rooms keep their own dark stage.

Bangla and English: the top bar **BN / EN** buttons switch the shell, home headings, product actions, account menu, and the transactions page. Product titles and shop names stay as they are stored. The choice is saved in `eme-lang`.

## Before the first run

1. Open `web/js/config.js`.
2. Replace `YOUR_SUPABASE_URL` with the project URL.
3. Replace `YOUR_SUPABASE_ANON_KEY` with the anon key (or the publishable key).
4. Leave the service role key out of this folder.

If those placeholders are still present, the home page shows a red banner and ends the skeleton loaders with a Retry button instead of hanging.

## Run

Serve the `web` folder:

```powershell
cd web
python -m http.server 8770
```

Then open [http://localhost:8770/](http://localhost:8770/).

If the server is started from the repo root instead, [http://localhost:8770/](http://localhost:8770/) redirects into `web/`. Old root pages such as `/pages/vendor.html` and `/pages/live.html` redirect to the real pages under `web/pages/`.

## Pages

### Shop

- `/` — home marketplace: hero, trust strip, categories, Flash Sale, Trending, promo banners, Live now (when any), Reels, Featured stores, New arrivals, Become a seller
- `/pages/shops.html` — approved store directory
- `/pages/shop.html?slug=` — storefront
- `/pages/sell.html` — Sell on EME + vendor apply form
- `/pages/categories.html` — category tree
- `/pages/products.html` — catalog filters + search (`?q=` has Products | Stores tabs)
- `/pages/product.html?slug=` — product details: gallery, price, stock, description, seller, reviews, related products, Buy Now and Add to cart
- `/pages/cart.html` — cart grouped by store → checkout
- `/pages/account/transactions.html` — the signed-in customer's payment rows from `payments` (cash on delivery is written by `place_order`)
- `/pages/checkout.html` — address with division dropdown, Dhaka 60 / outside 120, COD (`place_order`). bKash/Nagad stay unavailable. Run `supabase/f7_payments.sql` so delivery marks COD paid and refunds work
- `/pages/account/order.html?id=` — invoice print, cancel while pending, refund request after delivery
- `/pages/account/orders.html` — customer order list
- `/pages/account/order.html?id=` — order detail, timeline, cancel while pending
- `/pages/vendor.html` — vendor studio: products, shop profile, live host, payouts (read-only), messages
- `/pages/chat.html?shop=` — customer starts a shop thread; `?id=` opens it
- `/pages/vendor-orders.html` — **approved vendors**: own line items + status transitions
- `/pages/admin.html` — **admins only**. Opens on Dashboard (shop, order, live, and dispute counts), then Vendors (pending / approved / suspended — Approve stays only until the shop is approved), Moderation, Orders, Disputes, Payouts, People, Catalog, Settings.
- `/pages/reels.html` — full-screen reels feed (`?start=<id>` opens at that reel)
- `/pages/reel.html?id=` — deep link into the same feed (scroll continues to next reels)
- `/pages/vendor-reels.html` — **approved vendors only**: upload, tag products, publish, delete reels
- `/pages/lives.html` — Live now + Upcoming stream cards
- `/pages/live.html?id=` — live room. Video connects through the `livekit-token` edge function when LiveKit secrets are set. Chat send needs login. Guest read needs `supabase/f8_live_guest_chat.sql`
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
- Checkout uses the `place_order` RPC. Cash on delivery is the payment method. Delivery inside Dhaka is 60 and outside Dhaka is 120. Run `supabase/f7_payments.sql` so a delivered COD order is marked paid and refunds can be requested.
- Shipping is not read from `platform_settings`. There is no `shipping_methods` or `coupons` table.
- Payment method choices are UI-only (no `payment_method` enum; `payments.provider` is free text).
- Reels: public can watch published reels of approved shops. Like / follow / comment need login. **View and share counts are not writable by the client** (trigger-guarded). Buy Now opens tagged products and uses the cart — it does not create an order.
- Reels API: `web/js/api/reelsApi.js`. Viewer: `web/js/reels/` + `web/css/reels.css`.
- Live: public can read `scheduled` / `live` / `ended` rooms of approved shops. The host starts a room from Vendor studio (**Start live**, or the Live tab). The room opens the camera in the browser. Chat send needs login. Guest read needs `supabase/f8_live_guest_chat.sql`. Video uses LiveKit when `livekit-token` secrets are set, and a direct camera connection when they are not. Realtime watches `live_messages` inserts and `live_streams` updates. **There is no live viewer-count column** — only readable `peak_viewers` (not client-writable).
- Live API: `web/js/api/liveApi.js`. UI: `web/js/live/` + `web/css/live.css`. List: `pages/lives.html`. Room: `pages/live.html?id=`. Vendor studio: `pages/vendor.html#live`.

## APIs

Already connected in the browser (anon key only, RLS enforces access):

- Supabase Auth — sign up, sign in, password reset
- Supabase Postgres — products, shops, cart, orders, payments, reels, live, chat
- Supabase Storage — product, shop, reel, and live images
- Supabase Realtime — live chat and live room updates
- Edge function `livekit-token` — only when LiveKit secrets are deployed

Still needed before those features can charge or notify:

- bKash merchant API and webhook, if customers should pay by bKash
- Nagad merchant API and webhook, if customers should pay by Nagad
- Card processor, if card checkout is required
- Email provider beyond Supabase Auth mail, for order updates
- SMS provider, for delivery updates
- LiveKit Cloud (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) when many viewers on different networks must see the camera

## Auth notes

If email confirmation is turned on in the Supabase dashboard, registration asks the person to confirm before signing in. Add `http://localhost:8770` (and your Live Server origin) to the project's redirect URLs when you use confirmation links.
