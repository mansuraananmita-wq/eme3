# Real demo product images (Pixabay)

Fetches free-license Pixabay photos for the 150 demo products, stores copies in
Supabase Storage (hotlinking is not allowed), and regenerates
`supabase/seed_demo_images_real.sql`.

## Prerequisites

1. Put secrets in `E:\eme3\.env.local` (never commit this file):

```
PIXABAY_API_KEY=...
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

2. `.env.local` must stay gitignored (covered by `.env.*`).
3. Optional: `npm i sharp` in the repo root for 800×800 JPEG crop. Without sharp,
   original downloads are kept as-is (still uploaded as `.jpg` bytes).

The **service_role** key is used only by this local script for Storage uploads.
Never put it in `web/` or any frontend file.

## Run

```powershell
node supabase/scripts/fetch-real-product-images.mjs
```

Safe to re-run: existing `web/assets/demo-products-real/{index}-{slug}.jpg`
files with a matching OK entry in `supabase/scripts/real-image-state.json` are skipped.
Respects Pixabay’s ~100 requests / 60 seconds limit (throttle + 429 retry).

## Outputs

| File | Purpose |
|---|---|
| `web/assets/demo-products-real/*.jpg` | Local copies |
| Storage `product-images/demo/products-real/*.jpg` | Public CDN copies |
| `supabase/scripts/real-image-report.txt` | Title, query, Pixabay page, user, file, failures |
| `supabase/scripts/real-image-state.json` | Resume / re-run metadata |
| `supabase/seed_demo_images_real.sql` | DB update (delete + insert primary URLs) |

## Apply to the database

After a successful fetch, run in the Supabase SQL Editor:

```
supabase/seed_demo_images_real.sql
```

That deletes prior demo `product_images` for products `d222…0001`–`0150` and
inserts one primary row per successfully fetched product (no duplicate primaries).

Products listed as `FAIL` in the report need a manual photo replacement.
