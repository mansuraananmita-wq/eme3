# Upload demo SVG images to Supabase Storage

The frontend accepts **full HTTPS URLs** in `product_images.storage_path`, `vendor_profiles.logo_url` / `banner_url`, and `reels.thumbnail_path`. Seed files point at:

`https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/...`

You must upload the local SVGs into the **public** `product-images` bucket under the `demo/` prefix before images appear in the app.

## Local files → Storage keys

| Local path | Storage object key |
|---|---|
| `web/assets/demo-products/*.svg` | `demo/products/<name>.svg` |
| `web/assets/demo-shops/*.svg` | `demo/shops/<name>.svg` |
| `web/assets/demo-reels/*.svg` | `demo/reels/<name>.svg` |

## Option A — Dashboard (reliable)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project `uqlqgkwaqsikydckydau` → **Storage** → bucket **product-images**.
2. Create folders: `demo` → `products`, `shops`, `reels` (if missing).
3. Upload all files from `web/assets/demo-products/` into `demo/products/` (MIME `image/svg+xml` if asked).
4. Upload `web/assets/demo-shops/` into `demo/shops/`.
5. Upload `web/assets/demo-reels/` into `demo/reels/`.
6. Smoke-check one URL in the browser, e.g.  
   `https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/phone.svg`

## Option B — Supabase CLI

From the repo root (requires CLI logged in and linked to this project):

```powershell
# Products
Get-ChildItem web\assets\demo-products\*.svg | ForEach-Object {
  npx supabase storage cp $_.FullName "ss:///product-images/demo/products/$($_.Name)" --experimental
}

# Shops
Get-ChildItem web\assets\demo-shops\*.svg | ForEach-Object {
  npx supabase storage cp $_.FullName "ss:///product-images/demo/shops/$($_.Name)" --experimental
}

# Reels
Get-ChildItem web\assets\demo-reels\*.svg | ForEach-Object {
  npx supabase storage cp $_.FullName "ss:///product-images/demo/reels/$($_.Name)" --experimental
}
```

If your CLI version uses `storage upload` instead of `storage cp`, use that equivalent path form: `product-images/demo/products/<file>`.

## Wire the database (safe re-run, no duplicate primaries)

**Existing demo DB** (already ran `seed_demo.sql` once):

1. Upload Storage files (above).
2. In SQL Editor, run the full contents of `supabase/seed_demo_images.sql`.

That script:

- deletes all `product_images` for demo products `d222…0001`–`0150` (clears old picsum extras),
- inserts/updates 150 primary SVG rows (`d333…0001`–`0150`),
- updates shop logos/banners and reel thumbnails.

**Fresh project** (no demo yet):

1. Upload Storage files.
2. Run `supabase/seed.sql` (base categories) if needed, then `supabase/seed_demo.sql` (already points at the SVG URLs).

Optional: regenerate assets later with:

```powershell
node supabase/scripts/generate-demo-images.mjs
node supabase/scripts/patch-seed-demo-images.mjs
```
