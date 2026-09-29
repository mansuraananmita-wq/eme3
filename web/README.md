# EME web app

Static shop front. Open it through a local web server so ES modules and Supabase can load. Do not open the HTML files directly from the file explorer.

## Before the first run

1. Open `web/js/config.js`.
2. Replace `YOUR_SUPABASE_URL` with the project URL.
3. Replace `YOUR_SUPABASE_ANON_KEY` with the anon key (or the publishable key).
4. Leave the service role key out of this folder.

## Run

From the `web` folder:

```powershell
python -m http.server 8770
```

Then open [http://localhost:8770/](http://localhost:8770/).

Home loads active categories and active products from approved shops. Sign in and registration talk to Supabase Auth. A new account is always a customer. Cart, checkout, reels, live, vendor, and admin screens are not in this step. The cart and wishlist icons show counts and a short notice.

## Auth notes

If email confirmation is turned on in the Supabase dashboard, registration asks the person to confirm before signing in. Add `http://localhost:8770` to the project's redirect URLs when you use confirmation links.
