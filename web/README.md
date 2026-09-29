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

- `/` — home: categories, featured stores, top stores, trending, new arrivals, become-a-seller banner
- `/pages/shops.html` — approved store directory (search by shop name)
- `/pages/shop.html?slug=` — storefront (`?id=` also works). Tabs: Products, About, Reels, Live
- `/pages/sell.html` — Sell on EME landing + vendor apply form (RLS allows pending insert when signed in)
- `/pages/categories.html` — active category tree
- `/pages/products.html` — filters for category, **store**, price, and sort. Search uses `?q=`; with a query, Products | Stores tabs appear
- `/pages/product.html?slug=` — product details, seller card, more from store, related (`?id=` also works)
- `/pages/cart.html` — cart grouped by store (logo, link, per-store subtotal, shipping note)
- `/pages/wishlist.html` — requires sign-in (`?redirect=`)
- `/pages/login.html` and `/pages/register.html`

Checkout, full reels/live players, vendor dashboard, and admin screens are not built yet. Buy now and proceed to checkout stay disabled.

## Marketplace notes

- Shops come from `vendor_profiles` (approved only in public lists).
- Product cards show store logo + “Sold by …” linking to the storefront.
- There is **no** shop rating or verified badge column in the schema, so those UI bits are omitted.
- Platform commission is read from `platform_settings.commission_rate` on the sell page when present.

## Auth notes

If email confirmation is turned on in the Supabase dashboard, registration asks the person to confirm before signing in. Add `http://localhost:8770` (and your Live Server origin) to the project's redirect URLs when you use confirmation links.
