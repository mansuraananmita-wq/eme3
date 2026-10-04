# EME — বাকি কাজ

আসল সাইট `web/`। চালাতে `cd web` তারপর `python -m http.server 8770`, তারপর `http://localhost:8770/`।

রুটের `index.html` আর `pages/` পুরনো placeholder। শপ, কার্ট, অর্ডার সেখানে কাজ করে না। নতুন ফিচার শুধু `web/`-এ।

## হাতে করতে হবে

এই ফাইলগুলো রিপোতে আছে। Supabase-এ এখনো চালানো হয়নি। SQL এডিটরে পুরো ফাইল পেস্ট করে Run করতে হবে।

1. `supabase/f7_payments.sql` — ডেলিভার হলে COD `paid`, পুরো ক্যানসেল হলে pending পেমেন্ট `failed`, কাস্টমার রিফান্ড আবেদন, অ্যাডমিন রিফান্ড। না চালালে এই চারটা কাজ করে না।
2. `supabase/f8_live_guest_chat.sql` — লগইন ছাড়া লাইভ চ্যাট পড়া। মেসেজ পাঠাতে এখনো লগইন লাগে।
3. `supabase/f9_reel_engagement.sql` — রিল ভিউ ও শেয়ার একবার প্রতি ব্রাউজার সেশনে। না চালালে সেই দুই সংখ্যা বাড়ে না। সেভ, লাইক, কমেন্ট, রিপ্লাই আগের টেবিল দিয়েই চলে।
4. `supabase/f10_signup_roles.sql` — একবার পেস্ট করে Run। এরপর রেজিস্টারে Customer, Vendor, Admin বাছাই করা যায়। পুরনো অ্যাকাউন্ট কাস্টমার পেজ, ভেন্ডর স্টুডিও, বা অ্যাডমিন পেজ থেকে “Use this account as …” বাটনেই রোল বদলায়। ইমেইল দিয়ে `role = 'admin'` আপডেট আর দরকার নেই। এই ফাইল না চালালে বাটনটা এই বাক্যটাই দেখাবে।

ভেন্ডর বাছলে দোকান সাথে সাথে approved হয়, তাই স্টুডিওর Live ট্যাব থেকে Go live করা যায়। কাস্টমার সেই রুম হোম, My account, আর `pages/lives.html`-এ দেখে।

5. লাইভ ক্যামেরা। LiveKit ক্লাউড অ্যাকাউন্ট লাগবে, তারপর:

```powershell
supabase functions deploy livekit-token
supabase secrets set LIVEKIT_URL=wss://YOUR.livekit.cloud LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
```

সিক্রেট না থাকলেও হোস্টের ক্যামেরা লাইভ রুমে খোলে এবং দর্শক সেই রুমে ভিডিও দেখে। অনেক দর্শক বা আলাদা নেটওয়ার্কের জন্য LiveKit সিক্রেট লাগে। না থাকলে রুম, চ্যাট, পিন প্রোডাক্ট থাকে।

6. Supabase → Authentication → URL configuration। Site URL আর Redirect URLs-এ যোগ করতে হবে:

- `http://localhost:8770`
- `https://eme3.netlify.app`

নাহলে পাসওয়ার্ড রিসেট আর ইমেইল কনফার্ম লিংক সাইটে ফিরে আসে না। রিসেট লিঙ্ক প্রোফাইল পেজে খোলে (`pages/account/profile.html`)।

7. Netlify-এর publish directory `web`। ভিজিটর সবাই দেখতে পারবে এমন করতে Site configuration → Access থেকে সাইট public করতে হবে। নাহলে “Sign in to Netlify” আসে।

`supabase/f6_orders.sql` আগে চালানো থাকলে আবার চালানোর দরকার নেই। পেমেন্ট সেটেলমেন্ট `f7_payments.sql`-এ আছে।

তিন রোলের পাতা আলাদা:

- কাস্টমার: `web/pages/customer.html`
- ভেন্ডর: `web/pages/vendor.html` (অর্ডার `vendor-orders.html`, রিল `vendor-reels.html`)
- অ্যাডমিন: `web/pages/admin.html`

## এখনো বানানো হয়নি

পেমেন্ট:

- bKash / Nagad চার্জ হয় না। মার্চেন্ট অ্যাকাউন্ট ও ওয়েবহুক নেই
- কুপন কলাম নেই
- ইমেইল বা এসএমএস নোটিফিকেশন নেই
- রিফান্ডে স্টক ফেরে না
- চেকআউটের ডেলিভারি এখনো ঢাকা ৬০ / বাইরে ১২০ (`place_order`)। অ্যাডমিন Settings-এর `default_shipping_fee` চেকআউট বদলায় না

সার্চ ও রেকমেন্ডেশন:

- প্রোডাক্ট নামের সার্চ আছে
- রিল ভিউ/শেয়ার ছাড়া `user_events` (প্রোডাক্ট ভিউ, কার্ট, কেনাকাটা) লেখা হয় না
- `products`, `reels`, `live_streams`-এর `embedding` খালি। ANN ইনডেক্স নেই

অ্যাকাউন্ট ও পরিষ্কার করা:

- পুরো UI দ্বিভাষিক নয়। BN/EN বাটন এখনো ভাষা বদলায় না
- `claim_account_role` এখন যেকোনো লগইন ইউজারকে admin বানাতে পারে, যাতে টেস্টে SQL লাগে না। সাইটে বাইরের কাস্টমার আসার আগে SQL এডিটরে চালাতে হবে: `revoke execute on function public.claim_account_role(text, text) from authenticated;` এবং রেজিস্টার পেজ থেকে Admin অপশন সরিয়ে ফেলতে হবে
- লাইভ ক্যামেরার ছবি আসে শুধু LiveKit সিক্রেট সেট থাকলে (উপরের ধাপ ৫)
- `web/README.md` মার্কেটপ্লেস নোট পুরনো: চেকআউট অর্ডার ইনসার্ট করে না বলা আছে, লাইভ ভিডিওকে placeholder বলা আছে, শিপিং ফি `platform_settings` থেকে আসে বলা আছে
- `docs/DATABASE.md` বলে `sales_count` কেউ লেখে না। `place_order` স্টক কমায় এবং `sales_count` বাড়ায়
- রুট `pages/` আর `web/pages/` দুটো ফ্রন্টএন্ড
- ডিপ্লয় (স্ট্যাটিক হোস্ট + Supabase redirect URL) ডকুমেন্টে নেই
- ফ্রন্টএন্ড টেস্ট নেই

## রিপোতে যা হয়ে গেছে

- হোম, ক্যাটাগরি, প্রোডাক্ট, সার্চ, দোকান, লগইন, প্রোফাইল, ঠিকানা, উইশলিস্ট
- কার্ট, চেকআউট (COD, `place_order`), কাস্টমার অর্ডার, pending ক্যানসেল, ইনভয়েস প্রিন্ট
- ভেন্ডর স্টুডিও: প্রোডাক্ট, ছবি, দোকান, লাইভ শিডিউল, পেআউট পড়া, চ্যাট
- ভেন্ডর অর্ডার স্ট্যাটাস `pending` → `processing` → `shipped` → `delivered`
- রিল ফিড, লাইক, কমেন্ট, রিপ্লাই, সেভ, শেয়ার, ভেন্ডর রিল আপলোড
- প্রোডাক্ট রিভিউ (ডেলিভার হওয়া অর্ডারের পর)
- লাইভ রুম প্লেয়ার (`livekit-token`) ও সাইন-ইন দর্শক গোনা
- অ্যাডমিন: দোকান, মডারেশন, অর্ডার ও রিফান্ড, রোল, ক্যাটাগরি, সেটিংস, ডিসপিউট, পেআউট
- দোকান ফলো, Following তালিকা, প্রোডাক্ট/দোকান থেকে মেসেজ, Help পেজ, পাসওয়ার্ড রিসেট ইমেইল
- কাস্টমার হোম `pages/customer.html`, ভেন্ডর স্টুডিও `pages/vendor.html`, অ্যাডমিন `pages/admin.html`
- রেজিস্টারে Customer / Vendor / Admin। একই অ্যাকাউন্ট থেকেও রোল বদল (`f10_signup_roles.sql` একবার চালালে)
- কাস্টমার হোম ও হোমে Live now। ভেন্ডর স্টুডিওর Live ট্যাবে Go live। দর্শক `pages/lives.html` ও `pages/live.html`
- মার্কেটপ্লেস রঙ কমলা (দোকানের বাটন, সার্চ, অফার বার)। দাম লালচে অ্যাকসেন্ট
