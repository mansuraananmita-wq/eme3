-- seed_demo.sql
-- Rich demo catalog for frontend testing. Run once in the Supabase SQL editor as postgres.
-- Requires: migrations 0001-0019 and supabase/seed.sql (base categories).
-- Product/shop/reel images are original SVGs under Storage product-images/demo/
-- (upload steps: supabase/scripts/upload-demo-images.md).
-- To refresh images on an existing demo DB without duplicates: run seed_demo_images.sql.
-- Idempotent (fixed uuids, ON CONFLICT DO NOTHING / image upsert). Commits. Does not disable triggers or FKs.
-- Demo vendors cannot sign in (unusable random password; plaintext discarded).
--
-- Fixed ids:
--   vendors:  d1111111-d111-4111-8111-000000000001 .. 0010
--   products: d2222222-d222-4222-8222-000000000001 .. 0150
--   images:   d3333333-d333-4333-8333-000000000001 .. 0150 (1 primary SVG each)
--   cats:     d4444444-d444-4444-8444-... (demo-only tops/subs; seed.sql cats reused by slug)
--   reels:    d5555555-d555-4555-8555-000000000001 .. 0030
--   live:     d7777777-d777-4777-8777-000000000001 .. 0002
-- Skipped: product_reviews (needs customer users), variants (no table), featured flags (no column).
-- Note: sales_count / reel likes_count / views_count are trigger-guarded and stay 0.

begin;

-- ---------------------------------------------------------------------------
-- Auth users (10)
-- ---------------------------------------------------------------------------
do $$
declare
  person record;
begin
  for person in
    select * from (values
      ('d1111111-d111-4111-8111-000000000001'::uuid, 'demo-vendor-1@eme.demo', 'Purush Fashion Owner'),
      ('d1111111-d111-4111-8111-000000000002'::uuid, 'demo-vendor-2@eme.demo', 'Nari Style Owner'),
      ('d1111111-d111-4111-8111-000000000003'::uuid, 'demo-vendor-3@eme.demo', 'Gadget Bazar Owner'),
      ('d1111111-d111-4111-8111-000000000004'::uuid, 'demo-vendor-4@eme.demo', 'Case Corner Owner'),
      ('d1111111-d111-4111-8111-000000000005'::uuid, 'demo-vendor-5@eme.demo', 'Ghor Kitchen Owner'),
      ('d1111111-d111-4111-8111-000000000006'::uuid, 'demo-vendor-6@eme.demo', 'Rupchaya Owner'),
      ('d1111111-d111-4111-8111-000000000007'::uuid, 'demo-vendor-7@eme.demo', 'Bazaar Basket Owner'),
      ('d1111111-d111-4111-8111-000000000008'::uuid, 'demo-vendor-8@eme.demo', 'Boighar Owner'),
      ('d1111111-d111-4111-8111-000000000009'::uuid, 'demo-vendor-9@eme.demo', 'Khelaghar Owner'),
      ('d1111111-d111-4111-8111-000000000010'::uuid, 'demo-vendor-10@eme.demo', 'Choto Bondhu Owner')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      person.id, 'authenticated', 'authenticated', person.email,
      extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
      null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', person.full_name),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    begin
      insert into auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) values (
        person.id, person.id,
        jsonb_build_object('sub', person.id::text, 'email', person.email),
        'email', person.id::text, now(), now(), now()
      ) on conflict do nothing;
    exception when others then null;
    end;
  end loop;
end;
$$;

update public.profiles
set role = 'vendor', full_name = coalesce(full_name, 'Demo Vendor')
where id in ('d1111111-d111-4111-8111-000000000001', 'd1111111-d111-4111-8111-000000000002', 'd1111111-d111-4111-8111-000000000003', 'd1111111-d111-4111-8111-000000000004', 'd1111111-d111-4111-8111-000000000005', 'd1111111-d111-4111-8111-000000000006', 'd1111111-d111-4111-8111-000000000007', 'd1111111-d111-4111-8111-000000000008', 'd1111111-d111-4111-8111-000000000009', 'd1111111-d111-4111-8111-000000000010');

-- ---------------------------------------------------------------------------
-- Approved shops
-- ---------------------------------------------------------------------------
insert into public.vendor_profiles (
  profile_id, shop_name, slug, description, logo_url, banner_url, status
) values
  ('d1111111-d111-4111-8111-000000000001', 'Purush Lane', 'demo-purush-lane', 'পুরুষদের ফ্যাশন। Men''s shirts, panjabi, jeans, and footwear from Dhaka makers.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/purush-lane-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/purush-lane-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000002', 'Nari Atelier', 'demo-nari-atelier', 'নারীদের পোশাক। Salwar, kurti, hijab, and heels for everyday elegance.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/nari-atelier-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/nari-atelier-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000003', 'Gadget Bazar BD', 'demo-gadget-bazar', 'ইলেকট্রনিক্স ও গ্যাজেট। Phones, laptops, and smart devices.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/gadget-bazar-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/gadget-bazar-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000004', 'Case Corner', 'demo-case-corner', 'মোবাইল একসেসরিজ। Cases, chargers, cables, and earbud gear.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/case-corner-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/case-corner-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000005', 'Ghor O Ranna', 'demo-ghor-o-ranna', 'ঘর ও রান্নাঘর। Cookware, furniture, and home comforts.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/ghor-o-ranna-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/ghor-o-ranna-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000006', 'Rupchaya Beauty', 'demo-rupchaya-beauty', 'সৌন্দর্য ও যত্ন। Skincare, makeup, and hair care for BD weather.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/rupchaya-beauty-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/rupchaya-beauty-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000007', 'Bazaar Basket', 'demo-bazaar-basket', 'মুদি ও খাবার। Tea, spices, snacks, and pantry staples.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/bazaar-basket-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/bazaar-basket-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000008', 'Boighar Stationery', 'demo-boighar', 'বই ও স্টেশনারি। Novels, notebooks, pens, and school supplies.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/boighar-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/boighar-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000009', 'Khelaghar Fitness', 'demo-khelaghar', 'খেলা ও ফিটনেস। Yoga mats, dumbbells, jerseys, and sports gear.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/khelaghar-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/khelaghar-banner.svg',
   'approved'),
  ('d1111111-d111-4111-8111-000000000010', 'Choto Bondhu Toys', 'demo-choto-bondhu', 'শিশু ও খেলনা। Soft toys, learning sets, and outdoor play.',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/choto-bondhu-logo.svg',
   'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/choto-bondhu-banner.svg',
   'approved')
on conflict (profile_id) do update set
  shop_name = excluded.shop_name,
  slug = excluded.slug,
  description = excluded.description,
  logo_url = excluded.logo_url,
  banner_url = excluded.banner_url,
  status = excluded.status;

-- ---------------------------------------------------------------------------
-- Extra categories (12 tops total with seed.sql: electronics, fashion,
-- home-and-living, beauty + 8 new). Match existing by slug; no duplicates.
-- ---------------------------------------------------------------------------
insert into public.categories (id, parent_id, name, slug, image_url, sort_order, is_active) values
  ('d4444444-d444-4444-8444-000000000001', null, 'Grocery & Food', 'grocery-and-food', 'https://picsum.photos/seed/cat-grocery-and-food/200/200', 50, true),
  ('d4444444-d444-4444-8444-000000000002', null, 'Books & Stationery', 'books-and-stationery', 'https://picsum.photos/seed/cat-books-and-stationery/200/200', 60, true),
  ('d4444444-d444-4444-8444-000000000003', null, 'Sports & Fitness', 'sports-and-fitness', 'https://picsum.photos/seed/cat-sports-and-fitness/200/200', 70, true),
  ('d4444444-d444-4444-8444-000000000004', null, 'Kids & Toys', 'kids-and-toys', 'https://picsum.photos/seed/cat-kids-and-toys/200/200', 80, true),
  ('d4444444-d444-4444-8444-000000000005', null, 'Mobile Accessories', 'mobile-accessories', 'https://picsum.photos/seed/cat-mobile-accessories/200/200', 15, true),
  ('d4444444-d444-4444-8444-000000000006', null, 'Health & Wellness', 'health-and-wellness', 'https://picsum.photos/seed/cat-health-and-wellness/200/200', 90, true),
  ('d4444444-d444-4444-8444-000000000007', null, 'Bags & Luggage', 'bags-and-luggage', 'https://picsum.photos/seed/cat-bags-and-luggage/200/200', 100, true),
  ('d4444444-d444-4444-8444-000000000008', null, 'Watches & Jewellery', 'watches-and-jewellery', 'https://picsum.photos/seed/cat-watches-and-jewellery/200/200', 110, true),
  ('d4444444-d444-4444-8444-000000000011', 'd4444444-d444-4444-8444-000000000001', 'Tea & Coffee', 'grocery-tea', 'https://picsum.photos/seed/cat-grocery-tea/200/200', 10, true),
  ('d4444444-d444-4444-8444-000000000012', 'd4444444-d444-4444-8444-000000000001', 'Oils & Ghee', 'grocery-oils', 'https://picsum.photos/seed/cat-grocery-oils/200/200', 20, true),
  ('d4444444-d444-4444-8444-000000000013', 'd4444444-d444-4444-8444-000000000001', 'Staples', 'grocery-staples', 'https://picsum.photos/seed/cat-grocery-staples/200/200', 30, true),
  ('d4444444-d444-4444-8444-000000000014', 'd4444444-d444-4444-8444-000000000001', 'Spices', 'grocery-spices', 'https://picsum.photos/seed/cat-grocery-spices/200/200', 40, true),
  ('d4444444-d444-4444-8444-000000000015', 'd4444444-d444-4444-8444-000000000001', 'Snacks', 'grocery-snacks', 'https://picsum.photos/seed/cat-grocery-snacks/200/200', 50, true),
  ('d4444444-d444-4444-8444-000000000021', 'd4444444-d444-4444-8444-000000000002', 'Fiction', 'books-fiction', 'https://picsum.photos/seed/cat-books-fiction/200/200', 10, true),
  ('d4444444-d444-4444-8444-000000000022', 'd4444444-d444-4444-8444-000000000002', 'Education', 'books-education', 'https://picsum.photos/seed/cat-books-education/200/200', 20, true),
  ('d4444444-d444-4444-8444-000000000023', 'd4444444-d444-4444-8444-000000000002', 'Paper', 'stationery-paper', 'https://picsum.photos/seed/cat-stationery-paper/200/200', 30, true),
  ('d4444444-d444-4444-8444-000000000024', 'd4444444-d444-4444-8444-000000000002', 'Pens', 'stationery-pens', 'https://picsum.photos/seed/cat-stationery-pens/200/200', 40, true),
  ('d4444444-d444-4444-8444-000000000025', 'd4444444-d444-4444-8444-000000000002', 'School', 'stationery-school', 'https://picsum.photos/seed/cat-stationery-school/200/200', 50, true),
  ('d4444444-d444-4444-8444-000000000031', 'd4444444-d444-4444-8444-000000000003', 'Yoga', 'sports-yoga', 'https://picsum.photos/seed/cat-sports-yoga/200/200', 10, true),
  ('d4444444-d444-4444-8444-000000000032', 'd4444444-d444-4444-8444-000000000003', 'Gym', 'sports-gym', 'https://picsum.photos/seed/cat-sports-gym/200/200', 20, true),
  ('d4444444-d444-4444-8444-000000000033', 'd4444444-d444-4444-8444-000000000003', 'Outdoor', 'sports-outdoor', 'https://picsum.photos/seed/cat-sports-outdoor/200/200', 30, true),
  ('d4444444-d444-4444-8444-000000000034', 'd4444444-d444-4444-8444-000000000003', 'Apparel', 'sports-apparel', 'https://picsum.photos/seed/cat-sports-apparel/200/200', 40, true),
  ('d4444444-d444-4444-8444-000000000041', 'd4444444-d444-4444-8444-000000000004', 'Plush', 'toys-plush', 'https://picsum.photos/seed/cat-toys-plush/200/200', 10, true),
  ('d4444444-d444-4444-8444-000000000042', 'd4444444-d444-4444-8444-000000000004', 'Learning', 'toys-learning', 'https://picsum.photos/seed/cat-toys-learning/200/200', 20, true),
  ('d4444444-d444-4444-8444-000000000043', 'd4444444-d444-4444-8444-000000000004', 'Outdoor Play', 'toys-outdoor', 'https://picsum.photos/seed/cat-toys-outdoor/200/200', 30, true),
  ('d4444444-d444-4444-8444-000000000051', 'd4444444-d444-4444-8444-000000000005', 'Mounts & Holders', 'mobile-mounts', 'https://picsum.photos/seed/cat-mobile-mounts/200/200', 10, true),
  ('d4444444-d444-4444-8444-000000000052', 'd4444444-d444-4444-8444-000000000005', 'Cables & Adapters', 'mobile-cables', 'https://picsum.photos/seed/cat-mobile-cables/200/200', 20, true),
  ('d4444444-d444-4444-8444-000000000053', 'd4444444-d444-4444-8444-000000000005', 'Creator Gear', 'mobile-creator', 'https://picsum.photos/seed/cat-mobile-creator/200/200', 30, true),
  ('d4444444-d444-4444-8444-000000000061', 'd4444444-d444-4444-8444-000000000006', 'Supplements', 'health-supplements', 'https://picsum.photos/seed/cat-health-supplements/200/200', 10, true),
  ('d4444444-d444-4444-8444-000000000062', 'd4444444-d444-4444-8444-000000000006', 'Personal Care', 'health-personal-care', 'https://picsum.photos/seed/cat-health-personal-care/200/200', 20, true),
  ('d4444444-d444-4444-8444-000000000063', 'd4444444-d444-4444-8444-000000000006', 'First Aid', 'health-first-aid', 'https://picsum.photos/seed/cat-health-first-aid/200/200', 30, true),
  ('d4444444-d444-4444-8444-000000000071', 'd4444444-d444-4444-8444-000000000007', 'Handbags', 'bags-handbags', 'https://picsum.photos/seed/cat-bags-handbags/200/200', 10, true),
  ('d4444444-d444-4444-8444-000000000072', 'd4444444-d444-4444-8444-000000000007', 'Backpacks', 'bags-backpacks', 'https://picsum.photos/seed/cat-bags-backpacks/200/200', 20, true),
  ('d4444444-d444-4444-8444-000000000073', 'd4444444-d444-4444-8444-000000000007', 'Travel', 'bags-travel', 'https://picsum.photos/seed/cat-bags-travel/200/200', 30, true),
  ('d4444444-d444-4444-8444-000000000081', 'd4444444-d444-4444-8444-000000000008', 'Watches', 'jewellery-watches', 'https://picsum.photos/seed/cat-jewellery-watches/200/200', 10, true),
  ('d4444444-d444-4444-8444-000000000082', 'd4444444-d444-4444-8444-000000000008', 'Fashion Jewellery', 'jewellery-fashion', 'https://picsum.photos/seed/cat-jewellery-fashion/200/200', 20, true),
  ('d4444444-d444-4444-8444-000000000083', 'd4444444-d444-4444-8444-000000000008', 'Traditional', 'jewellery-traditional', 'https://picsum.photos/seed/cat-jewellery-traditional/200/200', 30, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Products (~150 active). created_at spread over last 60 days.
-- ---------------------------------------------------------------------------
insert into public.products (
  id, vendor_id, category_id, title, slug, description,
  price, compare_at_price, currency, stock, sku, status, created_at
)
select
  seed.id, seed.vendor_id, category.id, seed.title, seed.slug, seed.description,
  seed.price, seed.compare_at_price, 'BDT', seed.stock, seed.sku,
  'active'::public.product_status, seed.created_at
from (values
  ('d2222222-d222-4222-8222-000000000001'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Cotton Panjabi / সুতি পাঞ্জাবি', 'demo-purush-lane-p01', 'Lightweight cotton panjabi for Eid and Jummah.', 1890.00, 2490.00, 42, 'DM-1-P01', now() - interval '7 days'),
  ('d2222222-d222-4222-8222-000000000002'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Slim Fit Jeans', 'demo-purush-lane-p02', 'Stretch denim, mid wash for daily wear.', 2200.00, 2800.00, 25, 'DM-1-P02', now() - interval '14 days'),
  ('d2222222-d222-4222-8222-000000000003'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Oxford Shirt / অক্সফোর্ড শার্ট', 'demo-purush-lane-p03', 'Breathable oxford shirt, office ready.', 1450.00, null, 30, 'DM-1-P03', now() - interval '21 days'),
  ('d2222222-d222-4222-8222-000000000004'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-footwear', 'Leather Sandals / চামড়ার স্যান্ডেল', 'demo-purush-lane-p04', 'Hand-finished leather sandals.', 1450.00, 1800.00, 18, 'DM-1-P04', now() - interval '28 days'),
  ('d2222222-d222-4222-8222-000000000005'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-footwear', 'Canvas Sneakers', 'demo-purush-lane-p05', 'Everyday white sneakers with rubber sole.', 1750.00, 2100.00, 8, 'DM-1-P05', now() - interval '35 days'),
  ('d2222222-d222-4222-8222-000000000006'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Formal Belt', 'demo-purush-lane-p06', 'Genuine look PU belt with silver buckle.', 690.00, 850.00, 40, 'DM-1-P06', now() - interval '42 days'),
  ('d2222222-d222-4222-8222-000000000007'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Winter Hoodie', 'demo-purush-lane-p07', 'Fleece hoodie for Dhaka evenings.', 2100.00, 2590.00, 0, 'DM-1-P07', now() - interval '49 days'),
  ('d2222222-d222-4222-8222-000000000008'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Sports Shorts', 'demo-purush-lane-p08', 'Quick-dry shorts for gym and cricket.', 890.00, 1100.00, 55, 'DM-1-P08', now() - interval '56 days'),
  ('d2222222-d222-4222-8222-000000000009'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-footwear', 'Loafer Shoes', 'demo-purush-lane-p09', 'Comfort loafers for office and travel.', 3200.00, 3800.00, 12, 'DM-1-P09', now() - interval '3 days'),
  ('d2222222-d222-4222-8222-000000000010'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Cotton Undershirt Pack', 'demo-purush-lane-p10', '3-pack soft cotton vests.', 590.00, null, 70, 'DM-1-P10', now() - interval '10 days'),
  ('d2222222-d222-4222-8222-000000000011'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Linen Shirt', 'demo-purush-lane-p11', 'Breathable linen for summer.', 1690.00, 1990.00, 22, 'DM-1-P11', now() - interval '17 days'),
  ('d2222222-d222-4222-8222-000000000012'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Track Pants', 'demo-purush-lane-p12', 'Tapered track pants with zip pocket.', 1250.00, 1500.00, 28, 'DM-1-P12', now() - interval '24 days'),
  ('d2222222-d222-4222-8222-000000000013'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Cap / টুপি', 'demo-purush-lane-p13', 'Adjustable cotton baseball cap.', 450.00, 600.00, 60, 'DM-1-P13', now() - interval '31 days'),
  ('d2222222-d222-4222-8222-000000000014'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-footwear', 'Ankle Socks Pack', 'demo-purush-lane-p14', '5-pair ankle socks, mixed colours.', 390.00, null, 90, 'DM-1-P14', now() - interval '38 days'),
  ('d2222222-d222-4222-8222-000000000015'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Casual Blazer', 'demo-purush-lane-p15', 'Lightweight blazer for smart casual.', 4500.00, 5200.00, 6, 'DM-1-P15', now() - interval '45 days'),
  ('d2222222-d222-4222-8222-000000000016'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Cotton Salwar Kameez', 'demo-nari-atelier-w01', 'Three-piece cotton set with soft dupatta.', 2650.00, 3200.00, 30, 'DM-2-W01', now() - interval '52 days'),
  ('d2222222-d222-4222-8222-000000000017'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Linen Kurti / লিনেন কুর্তি', 'demo-nari-atelier-w02', 'Breathable linen kurti for office days.', 1590.00, 1990.00, 0, 'DM-2-W02', now() - interval '59 days'),
  ('d2222222-d222-4222-8222-000000000018'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-footwear', 'Block Heel Sandals', 'demo-nari-atelier-w03', 'Comfort 2-inch block heel.', 2100.00, 2600.00, 12, 'DM-2-W03', now() - interval '6 days'),
  ('d2222222-d222-4222-8222-000000000019'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Hijab Jersey Set', 'demo-nari-atelier-w04', 'Soft jersey hijab, two-pack.', 690.00, 850.00, 60, 'DM-2-W04', now() - interval '13 days'),
  ('d2222222-d222-4222-8222-000000000020'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Embroidered Saree / শাড়ি', 'demo-nari-atelier-w05', 'Lightweight saree with blouse piece.', 4800.00, 5500.00, 10, 'DM-2-W05', now() - interval '20 days'),
  ('d2222222-d222-4222-8222-000000000021'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Maxi Dress', 'demo-nari-atelier-w06', 'Flowy maxi for gatherings.', 2290.00, 2790.00, 18, 'DM-2-W06', now() - interval '27 days'),
  ('d2222222-d222-4222-8222-000000000022'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-footwear', 'Ballet Flats', 'demo-nari-atelier-w07', 'Soft ballet flats for all-day wear.', 1350.00, null, 24, 'DM-2-W07', now() - interval '34 days'),
  ('d2222222-d222-4222-8222-000000000023'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Denim Jacket', 'demo-nari-atelier-w08', 'Classic blue denim jacket.', 2450.00, 2990.00, 14, 'DM-2-W08', now() - interval '41 days'),
  ('d2222222-d222-4222-8222-000000000024'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Handbag / হ্যান্ডব্যাগ', 'demo-nari-atelier-w09', 'Structured handbag with zip pocket.', 1890.00, 2300.00, 20, 'DM-2-W09', now() - interval '48 days'),
  ('d2222222-d222-4222-8222-000000000025'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Leggings Pack', 'demo-nari-atelier-w10', '2-pack stretch cotton leggings.', 790.00, 990.00, 50, 'DM-2-W10', now() - interval '55 days'),
  ('d2222222-d222-4222-8222-000000000026'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Pearl Stud Earrings', 'demo-nari-atelier-w11', 'Everyday pearl studs.', 450.00, null, 40, 'DM-2-W11', now() - interval '2 days'),
  ('d2222222-d222-4222-8222-000000000027'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Palazzo Pants', 'demo-nari-atelier-w12', 'Wide-leg palazzo, soft rayon.', 1290.00, 1590.00, 26, 'DM-2-W12', now() - interval '9 days'),
  ('d2222222-d222-4222-8222-000000000028'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-footwear', 'Wedge Sandals', 'demo-nari-atelier-w13', 'Comfort wedge with ankle strap.', 1980.00, 2400.00, 9, 'DM-2-W13', now() - interval '16 days'),
  ('d2222222-d222-4222-8222-000000000029'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Abaya Plain', 'demo-nari-atelier-w14', 'Simple abaya with soft lining.', 2100.00, 2500.00, 16, 'DM-2-W14', now() - interval '23 days'),
  ('d2222222-d222-4222-8222-000000000030'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Silk Scarf', 'demo-nari-atelier-w15', 'Printed silk-feel scarf.', 890.00, 1100.00, 35, 'DM-2-W15', now() - interval '30 days'),
  ('d2222222-d222-4222-8222-000000000031'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'smartphones', 'Android Phone 128GB', 'demo-gadget-bazar-e01', '৬.৫ ইঞ্চি ডিসপ্লে, ৫০MP ক্যামেরা।', 24990.00, 27990.00, 15, 'DM-3-E01', now() - interval '37 days'),
  ('d2222222-d222-4222-8222-000000000032'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'smartphones', 'Budget Smartphone 64GB', 'demo-gadget-bazar-e02', 'Reliable dual-SIM daily driver.', 12990.00, 14990.00, 28, 'DM-3-E02', now() - interval '44 days'),
  ('d2222222-d222-4222-8222-000000000033'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'feature-phones', 'Feature Phone / বাটন মোবাইল', 'demo-gadget-bazar-e03', 'Long battery, torch, FM radio.', 1890.00, null, 50, 'DM-3-E03', now() - interval '51 days'),
  ('d2222222-d222-4222-8222-000000000034'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'ultrabooks', '14" Ultrabook i5', 'demo-gadget-bazar-e04', '16GB RAM, 512GB SSD for study and office.', 72990.00, 79990.00, 6, 'DM-3-E04', now() - interval '58 days'),
  ('d2222222-d222-4222-8222-000000000035'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'gaming-laptops', 'Gaming Laptop RTX', 'demo-gadget-bazar-e05', '144Hz screen with dedicated GPU.', 129990.00, 139990.00, 0, 'DM-3-E05', now() - interval '5 days'),
  ('d2222222-d222-4222-8222-000000000036'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'Bluetooth Speaker', 'demo-gadget-bazar-e06', 'Portable speaker with deep bass.', 2450.00, 2990.00, 22, 'DM-3-E06', now() - interval '12 days'),
  ('d2222222-d222-4222-8222-000000000037'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'Smart Watch Basic', 'demo-gadget-bazar-e07', 'Heart-rate and step tracking.', 3490.00, 3990.00, 18, 'DM-3-E07', now() - interval '19 days'),
  ('d2222222-d222-4222-8222-000000000038'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'Wireless Earbuds', 'demo-gadget-bazar-e08', 'ENC earbuds with charging case.', 1890.00, 2290.00, 40, 'DM-3-E08', now() - interval '26 days'),
  ('d2222222-d222-4222-8222-000000000039'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics', 'Tablet 10 inch', 'demo-gadget-bazar-e09', 'Wi-Fi tablet for reading and video.', 18990.00, 21990.00, 8, 'DM-3-E09', now() - interval '33 days'),
  ('d2222222-d222-4222-8222-000000000040'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'USB Hub 4-Port', 'demo-gadget-bazar-e10', 'USB 3.0 hub for laptop docks.', 690.00, 850.00, 55, 'DM-3-E10', now() - interval '40 days'),
  ('d2222222-d222-4222-8222-000000000041'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'Webcam HD', 'demo-gadget-bazar-e11', '1080p webcam with mic.', 2450.00, null, 14, 'DM-3-E11', now() - interval '47 days'),
  ('d2222222-d222-4222-8222-000000000042'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'Mechanical Keyboard', 'demo-gadget-bazar-e12', 'Hot-swap keys, RGB backlight.', 4200.00, 4800.00, 11, 'DM-3-E12', now() - interval '54 days'),
  ('d2222222-d222-4222-8222-000000000043'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics', 'Monitor 24 inch', 'demo-gadget-bazar-e13', 'IPS 75Hz office monitor.', 15990.00, 17990.00, 7, 'DM-3-E13', now() - interval '1 days'),
  ('d2222222-d222-4222-8222-000000000044'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'External SSD 1TB', 'demo-gadget-bazar-e14', 'USB-C portable SSD.', 8990.00, 9990.00, 19, 'DM-3-E14', now() - interval '8 days'),
  ('d2222222-d222-4222-8222-000000000045'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'Wi-Fi Router Dual Band', 'demo-gadget-bazar-e15', 'AC1200 dual-band router.', 3200.00, 3800.00, 25, 'DM-3-E15', now() - interval '15 days'),
  ('d2222222-d222-4222-8222-000000000046'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'chargers', '20W USB-C Fast Charger', 'demo-case-corner-m01', 'PD charger with 1m cable.', 890.00, 1200.00, 80, 'DM-4-M01', now() - interval '22 days'),
  ('d2222222-d222-4222-8222-000000000047'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'chargers', 'Power Bank 20000mAh', 'demo-case-corner-m02', 'দুই পোর্ট পাওয়ার ব্যাংক।', 1890.00, 2290.00, 35, 'DM-4-M02', now() - interval '29 days'),
  ('d2222222-d222-4222-8222-000000000048'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'cases-and-covers', 'Clear Phone Case', 'demo-case-corner-m03', 'Shock-absorb corners.', 450.00, 650.00, 100, 'DM-4-M03', now() - interval '36 days'),
  ('d2222222-d222-4222-8222-000000000049'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'cases-and-covers', 'Silicone Case Pack', 'demo-case-corner-m04', 'Three matte colours in one pack.', 990.00, null, 40, 'DM-4-M04', now() - interval '43 days'),
  ('d2222222-d222-4222-8222-000000000050'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'cases-and-covers', 'Tempered Glass Pack', 'demo-case-corner-m05', '2-pack 9H screen protectors.', 390.00, 550.00, 120, 'DM-4-M05', now() - interval '50 days'),
  ('d2222222-d222-4222-8222-000000000051'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'mobile-accessories', 'Magnetic Car Mount', 'demo-case-corner-m06', 'Dashboard magnetic phone holder.', 690.00, 850.00, 45, 'DM-4-M06', now() - interval '57 days'),
  ('d2222222-d222-4222-8222-000000000052'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'chargers', 'Braided USB-C Cable', 'demo-case-corner-m07', '1.5m nylon braided cable.', 350.00, 450.00, 90, 'DM-4-M07', now() - interval '4 days'),
  ('d2222222-d222-4222-8222-000000000053'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'mobile-accessories', 'Ring Light Mini', 'demo-case-corner-m08', 'Clip ring light for creators.', 1250.00, 1500.00, 20, 'DM-4-M08', now() - interval '11 days'),
  ('d2222222-d222-4222-8222-000000000054'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'mobile-accessories', 'Phone Tripod', 'demo-case-corner-m09', 'Foldable tripod with remote.', 890.00, 1100.00, 28, 'DM-4-M09', now() - interval '18 days'),
  ('d2222222-d222-4222-8222-000000000055'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'chargers', 'Wireless Charger Pad', 'demo-case-corner-m10', '15W Qi charging pad.', 1450.00, 1790.00, 0, 'DM-4-M10', now() - interval '25 days'),
  ('d2222222-d222-4222-8222-000000000056'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'mobile-accessories', 'Earphone Wired', 'demo-case-corner-m11', '3.5mm earbuds with mic.', 290.00, null, 150, 'DM-4-M11', now() - interval '32 days'),
  ('d2222222-d222-4222-8222-000000000057'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'chargers', 'OTG Adapter', 'demo-case-corner-m12', 'USB-C to USB-A OTG.', 180.00, 250.00, 200, 'DM-4-M12', now() - interval '39 days'),
  ('d2222222-d222-4222-8222-000000000058'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'mobile-accessories', 'Selfie Stick', 'demo-case-corner-m13', 'Bluetooth selfie stick.', 590.00, 750.00, 60, 'DM-4-M13', now() - interval '46 days'),
  ('d2222222-d222-4222-8222-000000000059'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'mobile-accessories', 'Phone Camera Lens Kit', 'demo-case-corner-m14', 'Wide and macro clip lenses.', 1590.00, 1990.00, 15, 'DM-4-M14', now() - interval '53 days'),
  ('d2222222-d222-4222-8222-000000000060'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'mobile-accessories', 'Cable Organiser Box', 'demo-case-corner-m15', 'Desk cable tidy box.', 450.00, null, 70, 'DM-4-M15', now() - interval '0 days'),
  ('d2222222-d222-4222-8222-000000000061'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'furniture', 'Study Table / পড়ার টেবিল', 'demo-ghor-o-ranna-h01', 'Compact wooden table with drawer.', 6500.00, 7500.00, 9, 'DM-5-H01', now() - interval '7 days'),
  ('d2222222-d222-4222-8222-000000000062'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'furniture', 'Folding Chair', 'demo-ghor-o-ranna-h02', 'Metal folding chair for guests.', 1850.00, null, 20, 'DM-5-H02', now() - interval '14 days'),
  ('d2222222-d222-4222-8222-000000000063'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Non-stick Fry Pan 24cm', 'demo-ghor-o-ranna-h03', 'নাসটিক ফ্রাইপ্যান। Even heat.', 1290.00, 1600.00, 40, 'DM-5-H03', now() - interval '21 days'),
  ('d2222222-d222-4222-8222-000000000064'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Pressure Cooker 5L', 'demo-ghor-o-ranna-h04', 'Aluminium cooker with safety valve.', 3200.00, 3800.00, 14, 'DM-5-H04', now() - interval '28 days'),
  ('d2222222-d222-4222-8222-000000000065'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Spice Jar Set / মসলার জার', 'demo-ghor-o-ranna-h05', '12 glass jars with stand.', 1450.00, 1800.00, 0, 'DM-5-H05', now() - interval '35 days'),
  ('d2222222-d222-4222-8222-000000000066'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'decor', 'Wall Clock', 'demo-ghor-o-ranna-h06', 'Silent sweep wall clock.', 890.00, 1100.00, 35, 'DM-5-H06', now() - interval '42 days'),
  ('d2222222-d222-4222-8222-000000000067'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'decor', 'Cushion Cover Set', 'demo-ghor-o-ranna-h07', '4 printed cushion covers.', 790.00, 990.00, 48, 'DM-5-H07', now() - interval '49 days'),
  ('d2222222-d222-4222-8222-000000000068'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'decor', 'Table Lamp', 'demo-ghor-o-ranna-h08', 'Warm LED table lamp.', 1650.00, 1990.00, 16, 'DM-5-H08', now() - interval '56 days'),
  ('d2222222-d222-4222-8222-000000000069'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'furniture', 'Shoe Rack', 'demo-ghor-o-ranna-h09', '4-tier metal shoe rack.', 2450.00, 2900.00, 12, 'DM-5-H09', now() - interval '3 days'),
  ('d2222222-d222-4222-8222-000000000070'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Steel Water Bottle', 'demo-ghor-o-ranna-h10', '1L insulated bottle.', 690.00, 850.00, 55, 'DM-5-H10', now() - interval '10 days'),
  ('d2222222-d222-4222-8222-000000000071'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Dinner Plate Set', 'demo-ghor-o-ranna-h11', '6 ceramic dinner plates.', 1890.00, 2300.00, 22, 'DM-5-H11', now() - interval '17 days'),
  ('d2222222-d222-4222-8222-000000000072'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Kitchen Knife Set', 'demo-ghor-o-ranna-h12', '3 knives with wooden block.', 2100.00, 2600.00, 18, 'DM-5-H12', now() - interval '24 days'),
  ('d2222222-d222-4222-8222-000000000073'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'decor', 'Floor Mat / পাপোশ', 'demo-ghor-o-ranna-h13', 'Washable anti-slip mat.', 990.00, null, 30, 'DM-5-H13', now() - interval '31 days'),
  ('d2222222-d222-4222-8222-000000000074'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'furniture', 'Storage Box Pack', 'demo-ghor-o-ranna-h14', '3 stackable plastic boxes.', 1250.00, 1500.00, 26, 'DM-5-H14', now() - interval '38 days'),
  ('d2222222-d222-4222-8222-000000000075'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Electric Kettle', 'demo-ghor-o-ranna-h15', '1.8L auto-off kettle.', 1450.00, 1750.00, 24, 'DM-5-H15', now() - interval '45 days'),
  ('d2222222-d222-4222-8222-000000000076'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Vitamin C Serum', 'demo-rupchaya-beauty-b01', 'Brightening serum for dull skin.', 890.00, 1200.00, 40, 'DM-6-B01', now() - interval '52 days'),
  ('d2222222-d222-4222-8222-000000000077'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Aloe Face Wash', 'demo-rupchaya-beauty-b02', 'Gentle aloe cleanser.', 450.00, 600.00, 70, 'DM-6-B02', now() - interval '59 days'),
  ('d2222222-d222-4222-8222-000000000078'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Sunscreen SPF50', 'demo-rupchaya-beauty-b03', 'Matte sunscreen for humid days.', 790.00, 990.00, 55, 'DM-6-B03', now() - interval '6 days'),
  ('d2222222-d222-4222-8222-000000000079'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'makeup', 'Matte Lipstick', 'demo-rupchaya-beauty-b04', 'Long-wear matte lipstick.', 550.00, 700.00, 45, 'DM-6-B04', now() - interval '13 days'),
  ('d2222222-d222-4222-8222-000000000080'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'makeup', 'Kajal / কাজল', 'demo-rupchaya-beauty-b05', 'Smudge-resistant kajal pencil.', 290.00, null, 80, 'DM-6-B05', now() - interval '20 days'),
  ('d2222222-d222-4222-8222-000000000081'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'makeup', 'Compact Powder', 'demo-rupchaya-beauty-b06', 'Oil-control compact.', 650.00, 800.00, 36, 'DM-6-B06', now() - interval '27 days'),
  ('d2222222-d222-4222-8222-000000000082'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'hair', 'Coconut Hair Oil', 'demo-rupchaya-beauty-b07', 'Pure coconut oil 200ml.', 390.00, 500.00, 90, 'DM-6-B07', now() - interval '34 days'),
  ('d2222222-d222-4222-8222-000000000083'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'hair', 'Herbal Shampoo', 'demo-rupchaya-beauty-b08', 'Sulphate-free herbal shampoo.', 480.00, 620.00, 60, 'DM-6-B08', now() - interval '41 days'),
  ('d2222222-d222-4222-8222-000000000084'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'hair', 'Hair Serum', 'demo-rupchaya-beauty-b09', 'Anti-frizz shine serum.', 720.00, 900.00, 28, 'DM-6-B09', now() - interval '48 days'),
  ('d2222222-d222-4222-8222-000000000085'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Night Cream', 'demo-rupchaya-beauty-b10', 'Hydrating overnight cream.', 950.00, 1190.00, 0, 'DM-6-B10', now() - interval '55 days'),
  ('d2222222-d222-4222-8222-000000000086'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Body Lotion', 'demo-rupchaya-beauty-b11', 'Cocoa butter body lotion.', 590.00, 750.00, 50, 'DM-6-B11', now() - interval '2 days'),
  ('d2222222-d222-4222-8222-000000000087'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'makeup', 'Nail Polish Set', 'demo-rupchaya-beauty-b12', '5-colour mini nail set.', 680.00, 850.00, 33, 'DM-6-B12', now() - interval '9 days'),
  ('d2222222-d222-4222-8222-000000000088'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Face Mask Pack', 'demo-rupchaya-beauty-b13', 'Sheet masks, pack of 5.', 420.00, null, 65, 'DM-6-B13', now() - interval '16 days'),
  ('d2222222-d222-4222-8222-000000000089'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'makeup', 'Eyebrow Pencil', 'demo-rupchaya-beauty-b14', 'Dual-tip brow pencil.', 320.00, 400.00, 48, 'DM-6-B14', now() - interval '23 days'),
  ('d2222222-d222-4222-8222-000000000090'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'hair', 'Hair Clip Set', 'demo-rupchaya-beauty-b15', 'Assorted clips and pins.', 250.00, 350.00, 100, 'DM-6-B15', now() - interval '30 days'),
  ('d2222222-d222-4222-8222-000000000091'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-tea', 'Premium Tea / চা পাতা ৫০০g', 'demo-bazaar-basket-g01', 'CTC tea for everyday cups.', 320.00, null, 80, 'DM-7-G01', now() - interval '37 days'),
  ('d2222222-d222-4222-8222-000000000092'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-oils', 'Mustard Oil 1L / সরিষার তেল', 'demo-bazaar-basket-g02', 'Cold-pressed mustard oil.', 280.00, 340.00, 60, 'DM-7-G02', now() - interval '44 days'),
  ('d2222222-d222-4222-8222-000000000093'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-staples', 'Basmati Rice 5kg', 'demo-bazaar-basket-g03', 'Aged basmati for biryani.', 890.00, 990.00, 40, 'DM-7-G03', now() - interval '51 days'),
  ('d2222222-d222-4222-8222-000000000094'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-spices', 'Masala Combo Pack', 'demo-bazaar-basket-g04', 'Turmeric, chilli, cumin set.', 450.00, 550.00, 55, 'DM-7-G04', now() - interval '58 days'),
  ('d2222222-d222-4222-8222-000000000095'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-staples', 'Honey 500g / মধু', 'demo-bazaar-basket-g05', 'Natural honey jar.', 520.00, 650.00, 35, 'DM-7-G05', now() - interval '5 days'),
  ('d2222222-d222-4222-8222-000000000096'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-snacks', 'Biscuits Assorted', 'demo-bazaar-basket-g06', 'Family biscuit tin.', 180.00, null, 120, 'DM-7-G06', now() - interval '12 days'),
  ('d2222222-d222-4222-8222-000000000097'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-snacks', 'Instant Noodles Pack', 'demo-bazaar-basket-g07', '8-pack masala noodles.', 240.00, 300.00, 90, 'DM-7-G07', now() - interval '19 days'),
  ('d2222222-d222-4222-8222-000000000098'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-staples', 'Lentils Mix 1kg / ডাল', 'demo-bazaar-basket-g08', 'Moong and masoor mix.', 210.00, 250.00, 70, 'DM-7-G08', now() - interval '26 days'),
  ('d2222222-d222-4222-8222-000000000099'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-spices', 'Pickle Jar / আচার', 'demo-bazaar-basket-g09', 'Mango pickle 400g.', 190.00, null, 45, 'DM-7-G09', now() - interval '33 days'),
  ('d2222222-d222-4222-8222-000000000100'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-tea', 'Coffee Jar 200g', 'demo-bazaar-basket-g10', 'Medium roast instant coffee.', 650.00, 780.00, 0, 'DM-7-G10', now() - interval '40 days'),
  ('d2222222-d222-4222-8222-000000000101'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-snacks', 'Sugar Free Dates', 'demo-bazaar-basket-g11', 'Seedless dates 500g.', 390.00, 480.00, 38, 'DM-7-G11', now() - interval '47 days'),
  ('d2222222-d222-4222-8222-000000000102'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-oils', 'Ghee 500g', 'demo-bazaar-basket-g12', 'Pure cow ghee.', 780.00, 900.00, 28, 'DM-7-G12', now() - interval '54 days'),
  ('d2222222-d222-4222-8222-000000000103'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-snacks', 'Chanachur Large', 'demo-bazaar-basket-g13', 'Spicy chanachur pack.', 150.00, null, 100, 'DM-7-G13', now() - interval '1 days'),
  ('d2222222-d222-4222-8222-000000000104'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-staples', 'Salt Iodised 1kg', 'demo-bazaar-basket-g14', 'Iodised table salt.', 40.00, null, 200, 'DM-7-G14', now() - interval '8 days'),
  ('d2222222-d222-4222-8222-000000000105'::uuid, 'd1111111-d111-4111-8111-000000000007'::uuid, 'grocery-tea', 'Green Tea Bags', 'demo-bazaar-basket-g15', '25 green tea bags.', 290.00, 360.00, 50, 'DM-7-G15', now() - interval '15 days'),
  ('d2222222-d222-4222-8222-000000000106'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'books-fiction', 'Bangla Novel Set', 'demo-boighar-k01', 'Two contemporary Bangla novels.', 650.00, 800.00, 25, 'DM-8-K01', now() - interval '22 days'),
  ('d2222222-d222-4222-8222-000000000107'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'books-fiction', 'English Storybook', 'demo-boighar-k02', 'Illustrated short stories.', 420.00, null, 40, 'DM-8-K02', now() - interval '29 days'),
  ('d2222222-d222-4222-8222-000000000108'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-paper', 'Notebook A5 Pack', 'demo-boighar-k03', '3 ruled A5 notebooks.', 180.00, 220.00, 100, 'DM-8-K03', now() - interval '36 days'),
  ('d2222222-d222-4222-8222-000000000109'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-pens', 'Gel Pen Set', 'demo-boighar-k04', '10 smooth gel pens.', 120.00, 150.00, 150, 'DM-8-K04', now() - interval '43 days'),
  ('d2222222-d222-4222-8222-000000000110'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-school', 'Geometry Box', 'demo-boighar-k05', 'Metal geometry set.', 250.00, 320.00, 60, 'DM-8-K05', now() - interval '50 days'),
  ('d2222222-d222-4222-8222-000000000111'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-school', 'Colour Pencil Pack', 'demo-boighar-k06', '24-shade colour pencils.', 190.00, null, 80, 'DM-8-K06', now() - interval '57 days'),
  ('d2222222-d222-4222-8222-000000000112'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'books-education', 'SSC Guide Math', 'demo-boighar-k07', 'Math guide for SSC.', 380.00, 450.00, 30, 'DM-8-K07', now() - interval '4 days'),
  ('d2222222-d222-4222-8222-000000000113'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'books-education', 'Dictionary Pocket', 'demo-boighar-k08', 'English-Bangla pocket dictionary.', 290.00, 350.00, 45, 'DM-8-K08', now() - interval '11 days'),
  ('d2222222-d222-4222-8222-000000000114'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-paper', 'Sticky Notes Pack', 'demo-boighar-k09', 'Assorted sticky notes.', 90.00, null, 120, 'DM-8-K09', now() - interval '18 days'),
  ('d2222222-d222-4222-8222-000000000115'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-pens', 'Fountain Pen', 'demo-boighar-k10', 'Student fountain pen with ink.', 850.00, 990.00, 0, 'DM-8-K10', now() - interval '25 days'),
  ('d2222222-d222-4222-8222-000000000116'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-paper', 'Sketch Pad A4', 'demo-boighar-k11', '120gsm sketch pad.', 220.00, 280.00, 55, 'DM-8-K11', now() - interval '32 days'),
  ('d2222222-d222-4222-8222-000000000117'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-pens', 'Marker Set', 'demo-boighar-k12', '12 permanent markers.', 340.00, 400.00, 48, 'DM-8-K12', now() - interval '39 days'),
  ('d2222222-d222-4222-8222-000000000118'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'books-education', 'Children Alphabet Book', 'demo-boighar-k13', 'Bangla-English alphabet book.', 160.00, null, 70, 'DM-8-K13', now() - interval '46 days'),
  ('d2222222-d222-4222-8222-000000000119'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-paper', 'Planner 2026', 'demo-boighar-k14', 'Weekly planner hardcover.', 450.00, 550.00, 22, 'DM-8-K14', now() - interval '53 days'),
  ('d2222222-d222-4222-8222-000000000120'::uuid, 'd1111111-d111-4111-8111-000000000008'::uuid, 'stationery-school', 'Exam Pad', 'demo-boighar-k15', 'Ruled exam pad 80 sheets.', 60.00, 80.00, 200, 'DM-8-K15', now() - interval '0 days'),
  ('d2222222-d222-4222-8222-000000000121'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-yoga', 'Yoga Mat / যোগা ম্যাট', 'demo-khelaghar-s01', 'Non-slip 6mm yoga mat.', 890.00, 1100.00, 40, 'DM-9-S01', now() - interval '7 days'),
  ('d2222222-d222-4222-8222-000000000122'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-gym', 'Dumbbell Pair 5kg', 'demo-khelaghar-s02', 'Neoprene dumbbell pair.', 1450.00, 1750.00, 20, 'DM-9-S02', now() - interval '14 days'),
  ('d2222222-d222-4222-8222-000000000123'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-outdoor', 'Football Size 5', 'demo-khelaghar-s03', 'Match football.', 1200.00, 1500.00, 18, 'DM-9-S03', now() - interval '21 days'),
  ('d2222222-d222-4222-8222-000000000124'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-outdoor', 'Cricket Bat Kashmir', 'demo-khelaghar-s04', 'Kashmir willow bat.', 2800.00, 3400.00, 10, 'DM-9-S04', now() - interval '28 days'),
  ('d2222222-d222-4222-8222-000000000125'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-gym', 'Skipping Rope', 'demo-khelaghar-s05', 'Ball-bearing skipping rope.', 250.00, null, 70, 'DM-9-S05', now() - interval '35 days'),
  ('d2222222-d222-4222-8222-000000000126'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-apparel', 'Sports Jersey', 'demo-khelaghar-s06', 'Breathable match jersey.', 990.00, 1250.00, 35, 'DM-9-S06', now() - interval '42 days'),
  ('d2222222-d222-4222-8222-000000000127'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-apparel', 'Running Shoes', 'demo-khelaghar-s07', 'Cushioned road runners.', 3200.00, 3800.00, 14, 'DM-9-S07', now() - interval '49 days'),
  ('d2222222-d222-4222-8222-000000000128'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-gym', 'Resistance Band Set', 'demo-khelaghar-s08', '3 resistance levels.', 690.00, 850.00, 45, 'DM-9-S08', now() - interval '56 days'),
  ('d2222222-d222-4222-8222-000000000129'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-outdoor', 'Water Bottle Sports', 'demo-khelaghar-s09', 'Squeeze sports bottle 750ml.', 450.00, null, 60, 'DM-9-S09', now() - interval '3 days'),
  ('d2222222-d222-4222-8222-000000000130'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-gym', 'Gym Gloves', 'demo-khelaghar-s10', 'Padded lifting gloves.', 580.00, 720.00, 0, 'DM-9-S10', now() - interval '10 days'),
  ('d2222222-d222-4222-8222-000000000131'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-outdoor', 'Badminton Racket', 'demo-khelaghar-s11', 'Lightweight graphite racket.', 1100.00, 1400.00, 22, 'DM-9-S11', now() - interval '17 days'),
  ('d2222222-d222-4222-8222-000000000132'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-outdoor', 'Shuttlecock Pack', 'demo-khelaghar-s12', '12 nylon shuttles.', 320.00, 400.00, 50, 'DM-9-S12', now() - interval '24 days'),
  ('d2222222-d222-4222-8222-000000000133'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-apparel', 'Compression Tights', 'demo-khelaghar-s13', 'Men compression tights.', 1450.00, 1790.00, 16, 'DM-9-S13', now() - interval '31 days'),
  ('d2222222-d222-4222-8222-000000000134'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-yoga', 'Foam Roller', 'demo-khelaghar-s14', 'Muscle recovery roller.', 890.00, 1100.00, 19, 'DM-9-S14', now() - interval '38 days'),
  ('d2222222-d222-4222-8222-000000000135'::uuid, 'd1111111-d111-4111-8111-000000000009'::uuid, 'sports-apparel', 'Sports Cap Pack', 'demo-khelaghar-s15', '2 breathable sports caps.', 390.00, null, 55, 'DM-9-S15', now() - interval '45 days'),
  ('d2222222-d222-4222-8222-000000000136'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-plush', 'Soft Teddy / টেডি', 'demo-choto-bondhu-t01', 'Washable soft teddy bear.', 890.00, 1100.00, 30, 'DM-10-T01', now() - interval '52 days'),
  ('d2222222-d222-4222-8222-000000000137'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-learning', 'Building Blocks 100pc', 'demo-choto-bondhu-t02', 'Colourful building blocks.', 1250.00, 1500.00, 25, 'DM-10-T02', now() - interval '59 days'),
  ('d2222222-d222-4222-8222-000000000138'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-outdoor', 'Remote Car', 'demo-choto-bondhu-t03', 'Rechargeable remote car.', 1450.00, 1800.00, 18, 'DM-10-T03', now() - interval '6 days'),
  ('d2222222-d222-4222-8222-000000000139'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-learning', 'Puzzle Map BD', 'demo-choto-bondhu-t04', 'Bangladesh map puzzle.', 450.00, null, 40, 'DM-10-T04', now() - interval '13 days'),
  ('d2222222-d222-4222-8222-000000000140'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-learning', 'Colouring Kit', 'demo-choto-bondhu-t05', 'Crayons and colouring book.', 390.00, 500.00, 55, 'DM-10-T05', now() - interval '20 days'),
  ('d2222222-d222-4222-8222-000000000141'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-outdoor', 'Kids Football Mini', 'demo-choto-bondhu-t06', 'Soft mini football.', 590.00, 750.00, 28, 'DM-10-T06', now() - interval '27 days'),
  ('d2222222-d222-4222-8222-000000000142'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-plush', 'Doll Set', 'demo-choto-bondhu-t07', 'Fashion doll with outfits.', 1100.00, 1400.00, 0, 'DM-10-T07', now() - interval '34 days'),
  ('d2222222-d222-4222-8222-000000000143'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-learning', 'Stacking Rings', 'demo-choto-bondhu-t08', 'Classic stacking toy.', 320.00, null, 60, 'DM-10-T08', now() - interval '41 days'),
  ('d2222222-d222-4222-8222-000000000144'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-outdoor', 'Scooter Kids', 'demo-choto-bondhu-t09', '3-wheel kids scooter.', 3200.00, 3800.00, 8, 'DM-10-T09', now() - interval '48 days'),
  ('d2222222-d222-4222-8222-000000000145'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-learning', 'Story Flashcards', 'demo-choto-bondhu-t10', 'Bangla-English flashcards.', 280.00, 350.00, 70, 'DM-10-T10', now() - interval '55 days'),
  ('d2222222-d222-4222-8222-000000000146'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-plush', 'Bath Toy Set', 'demo-choto-bondhu-t11', 'Floating bath animals.', 450.00, 550.00, 35, 'DM-10-T11', now() - interval '2 days'),
  ('d2222222-d222-4222-8222-000000000147'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-learning', 'Drawing Board LCD', 'demo-choto-bondhu-t12', 'Reusable LCD writing tablet.', 890.00, 1100.00, 22, 'DM-10-T12', now() - interval '9 days'),
  ('d2222222-d222-4222-8222-000000000148'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-outdoor', 'Outdoor Bubble Gun', 'demo-choto-bondhu-t13', 'Battery bubble blaster.', 390.00, null, 48, 'DM-10-T13', now() - interval '16 days'),
  ('d2222222-d222-4222-8222-000000000149'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-plush', 'Plush Elephant', 'demo-choto-bondhu-t14', 'Large plush elephant.', 750.00, 900.00, 20, 'DM-10-T14', now() - interval '23 days'),
  ('d2222222-d222-4222-8222-000000000150'::uuid, 'd1111111-d111-4111-8111-000000000010'::uuid, 'toys-learning', 'Board Game Family', 'demo-choto-bondhu-t15', 'Simple family board game.', 1290.00, 1590.00, 15, 'DM-10-T15', now() - interval '30 days')
) as seed (id, vendor_id, category_slug, title, slug, description, price, compare_at_price, stock, sku, created_at)
join public.categories as category on category.slug = seed.category_slug
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Product images (1 matching SVG primary each; upload demo/ to product-images bucket)
-- Clear prior demo images (including old multi-picsum rows) so re-runs stay clean.
delete from public.product_images
where product_id between 'd2222222-d222-4222-8222-000000000001' and 'd2222222-d222-4222-8222-000000000150'
   or id between 'd3333333-d333-4333-8333-000000000001' and 'd3333333-d333-4333-8333-000000000525';

insert into public.product_images (id, product_id, storage_path, sort_order, is_primary)
select seed.id, seed.product_id, seed.storage_path, seed.sort_order, seed.is_primary
from (values
  ('d3333333-d333-4333-8333-000000000001'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/panjabi.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000002'::uuid, 'd2222222-d222-4222-8222-000000000002'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/jeans.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000003'::uuid, 'd2222222-d222-4222-8222-000000000003'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/shirt.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000004'::uuid, 'd2222222-d222-4222-8222-000000000004'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/sandals.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000005'::uuid, 'd2222222-d222-4222-8222-000000000005'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/sneakers.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000006'::uuid, 'd2222222-d222-4222-8222-000000000006'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/belt.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000007'::uuid, 'd2222222-d222-4222-8222-000000000007'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/hoodie.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000008'::uuid, 'd2222222-d222-4222-8222-000000000008'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/shorts.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000009'::uuid, 'd2222222-d222-4222-8222-000000000009'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/loafers.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000010'::uuid, 'd2222222-d222-4222-8222-000000000010'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/undershirt.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000011'::uuid, 'd2222222-d222-4222-8222-000000000011'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/shirt.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000012'::uuid, 'd2222222-d222-4222-8222-000000000012'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/trackpants.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000013'::uuid, 'd2222222-d222-4222-8222-000000000013'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/cap.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000014'::uuid, 'd2222222-d222-4222-8222-000000000014'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/socks.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000015'::uuid, 'd2222222-d222-4222-8222-000000000015'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/blazer.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000016'::uuid, 'd2222222-d222-4222-8222-000000000016'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/salwar.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000017'::uuid, 'd2222222-d222-4222-8222-000000000017'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/kurti.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000018'::uuid, 'd2222222-d222-4222-8222-000000000018'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/heels.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000019'::uuid, 'd2222222-d222-4222-8222-000000000019'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/hijab.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000020'::uuid, 'd2222222-d222-4222-8222-000000000020'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/saree.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000021'::uuid, 'd2222222-d222-4222-8222-000000000021'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/dress.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000022'::uuid, 'd2222222-d222-4222-8222-000000000022'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/flats.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000023'::uuid, 'd2222222-d222-4222-8222-000000000023'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/denim.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000024'::uuid, 'd2222222-d222-4222-8222-000000000024'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/handbag.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000025'::uuid, 'd2222222-d222-4222-8222-000000000025'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/leggings.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000026'::uuid, 'd2222222-d222-4222-8222-000000000026'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/earrings.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000027'::uuid, 'd2222222-d222-4222-8222-000000000027'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/palazzo.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000028'::uuid, 'd2222222-d222-4222-8222-000000000028'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/wedges.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000029'::uuid, 'd2222222-d222-4222-8222-000000000029'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/abaya.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000030'::uuid, 'd2222222-d222-4222-8222-000000000030'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/scarf.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000031'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/phone.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000032'::uuid, 'd2222222-d222-4222-8222-000000000032'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/phone.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000033'::uuid, 'd2222222-d222-4222-8222-000000000033'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/featurephone.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000034'::uuid, 'd2222222-d222-4222-8222-000000000034'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/laptop.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000035'::uuid, 'd2222222-d222-4222-8222-000000000035'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/gaminglaptop.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000036'::uuid, 'd2222222-d222-4222-8222-000000000036'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/speaker.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000037'::uuid, 'd2222222-d222-4222-8222-000000000037'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/smartwatch.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000038'::uuid, 'd2222222-d222-4222-8222-000000000038'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/earbuds.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000039'::uuid, 'd2222222-d222-4222-8222-000000000039'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/tablet.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000040'::uuid, 'd2222222-d222-4222-8222-000000000040'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/usbhub.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000041'::uuid, 'd2222222-d222-4222-8222-000000000041'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/webcam.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000042'::uuid, 'd2222222-d222-4222-8222-000000000042'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/keyboard.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000043'::uuid, 'd2222222-d222-4222-8222-000000000043'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/monitor.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000044'::uuid, 'd2222222-d222-4222-8222-000000000044'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/ssd.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000045'::uuid, 'd2222222-d222-4222-8222-000000000045'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/router.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000046'::uuid, 'd2222222-d222-4222-8222-000000000046'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/charger.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000047'::uuid, 'd2222222-d222-4222-8222-000000000047'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/powerbank.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000048'::uuid, 'd2222222-d222-4222-8222-000000000048'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/phonecase.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000049'::uuid, 'd2222222-d222-4222-8222-000000000049'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/phonecase.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000050'::uuid, 'd2222222-d222-4222-8222-000000000050'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/glass.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000051'::uuid, 'd2222222-d222-4222-8222-000000000051'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/carmount.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000052'::uuid, 'd2222222-d222-4222-8222-000000000052'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/cable.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000053'::uuid, 'd2222222-d222-4222-8222-000000000053'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/ringlight.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000054'::uuid, 'd2222222-d222-4222-8222-000000000054'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/tripod.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000055'::uuid, 'd2222222-d222-4222-8222-000000000055'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/wirelesspad.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000056'::uuid, 'd2222222-d222-4222-8222-000000000056'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/earphones.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000057'::uuid, 'd2222222-d222-4222-8222-000000000057'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/otg.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000058'::uuid, 'd2222222-d222-4222-8222-000000000058'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/selfiestick.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000059'::uuid, 'd2222222-d222-4222-8222-000000000059'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/lenskit.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000060'::uuid, 'd2222222-d222-4222-8222-000000000060'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/cablebox.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000061'::uuid, 'd2222222-d222-4222-8222-000000000061'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/table.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000062'::uuid, 'd2222222-d222-4222-8222-000000000062'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/chair.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000063'::uuid, 'd2222222-d222-4222-8222-000000000063'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/frypan.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000064'::uuid, 'd2222222-d222-4222-8222-000000000064'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/cooker.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000065'::uuid, 'd2222222-d222-4222-8222-000000000065'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/spicejars.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000066'::uuid, 'd2222222-d222-4222-8222-000000000066'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/wallclock.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000067'::uuid, 'd2222222-d222-4222-8222-000000000067'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/cushion.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000068'::uuid, 'd2222222-d222-4222-8222-000000000068'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/lamp.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000069'::uuid, 'd2222222-d222-4222-8222-000000000069'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/shoerack.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000070'::uuid, 'd2222222-d222-4222-8222-000000000070'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/bottle.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000071'::uuid, 'd2222222-d222-4222-8222-000000000071'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/plates.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000072'::uuid, 'd2222222-d222-4222-8222-000000000072'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/knives.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000073'::uuid, 'd2222222-d222-4222-8222-000000000073'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/floormat.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000074'::uuid, 'd2222222-d222-4222-8222-000000000074'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/storagebox.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000075'::uuid, 'd2222222-d222-4222-8222-000000000075'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/kettle.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000076'::uuid, 'd2222222-d222-4222-8222-000000000076'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/serum.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000077'::uuid, 'd2222222-d222-4222-8222-000000000077'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/facewash.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000078'::uuid, 'd2222222-d222-4222-8222-000000000078'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/sunscreen.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000079'::uuid, 'd2222222-d222-4222-8222-000000000079'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/lipstick.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000080'::uuid, 'd2222222-d222-4222-8222-000000000080'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/kajal.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000081'::uuid, 'd2222222-d222-4222-8222-000000000081'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/powder.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000082'::uuid, 'd2222222-d222-4222-8222-000000000082'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/hairoil.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000083'::uuid, 'd2222222-d222-4222-8222-000000000083'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/shampoo.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000084'::uuid, 'd2222222-d222-4222-8222-000000000084'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/hairserum.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000085'::uuid, 'd2222222-d222-4222-8222-000000000085'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/cream.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000086'::uuid, 'd2222222-d222-4222-8222-000000000086'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/lotion.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000087'::uuid, 'd2222222-d222-4222-8222-000000000087'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/nailpolish.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000088'::uuid, 'd2222222-d222-4222-8222-000000000088'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/facemask.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000089'::uuid, 'd2222222-d222-4222-8222-000000000089'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/brow.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000090'::uuid, 'd2222222-d222-4222-8222-000000000090'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/hairclips.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000091'::uuid, 'd2222222-d222-4222-8222-000000000091'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/tea.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000092'::uuid, 'd2222222-d222-4222-8222-000000000092'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/oil.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000093'::uuid, 'd2222222-d222-4222-8222-000000000093'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/rice.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000094'::uuid, 'd2222222-d222-4222-8222-000000000094'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/spices.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000095'::uuid, 'd2222222-d222-4222-8222-000000000095'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/honey.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000096'::uuid, 'd2222222-d222-4222-8222-000000000096'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/biscuits.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000097'::uuid, 'd2222222-d222-4222-8222-000000000097'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/noodles.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000098'::uuid, 'd2222222-d222-4222-8222-000000000098'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/lentils.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000099'::uuid, 'd2222222-d222-4222-8222-000000000099'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/pickle.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000100'::uuid, 'd2222222-d222-4222-8222-000000000100'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/coffee.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000101'::uuid, 'd2222222-d222-4222-8222-000000000101'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/dates.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000102'::uuid, 'd2222222-d222-4222-8222-000000000102'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/ghee.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000103'::uuid, 'd2222222-d222-4222-8222-000000000103'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/chanachur.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000104'::uuid, 'd2222222-d222-4222-8222-000000000104'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/salt.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000105'::uuid, 'd2222222-d222-4222-8222-000000000105'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/greentea.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000106'::uuid, 'd2222222-d222-4222-8222-000000000106'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/novel.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000107'::uuid, 'd2222222-d222-4222-8222-000000000107'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/storybook.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000108'::uuid, 'd2222222-d222-4222-8222-000000000108'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/notebook.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000109'::uuid, 'd2222222-d222-4222-8222-000000000109'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/pens.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000110'::uuid, 'd2222222-d222-4222-8222-000000000110'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/geometry.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000111'::uuid, 'd2222222-d222-4222-8222-000000000111'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/colorpencils.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000112'::uuid, 'd2222222-d222-4222-8222-000000000112'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/guide.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000113'::uuid, 'd2222222-d222-4222-8222-000000000113'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/dictionary.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000114'::uuid, 'd2222222-d222-4222-8222-000000000114'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/stickynotes.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000115'::uuid, 'd2222222-d222-4222-8222-000000000115'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/fountainpen.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000116'::uuid, 'd2222222-d222-4222-8222-000000000116'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/sketchpad.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000117'::uuid, 'd2222222-d222-4222-8222-000000000117'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/markers.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000118'::uuid, 'd2222222-d222-4222-8222-000000000118'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/alphabet.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000119'::uuid, 'd2222222-d222-4222-8222-000000000119'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/planner.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000120'::uuid, 'd2222222-d222-4222-8222-000000000120'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/exampad.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000121'::uuid, 'd2222222-d222-4222-8222-000000000121'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/yogamat.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000122'::uuid, 'd2222222-d222-4222-8222-000000000122'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/dumbbell.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000123'::uuid, 'd2222222-d222-4222-8222-000000000123'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/football.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000124'::uuid, 'd2222222-d222-4222-8222-000000000124'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/cricketbat.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000125'::uuid, 'd2222222-d222-4222-8222-000000000125'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/skippingrope.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000126'::uuid, 'd2222222-d222-4222-8222-000000000126'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/jersey.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000127'::uuid, 'd2222222-d222-4222-8222-000000000127'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/runningshoes.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000128'::uuid, 'd2222222-d222-4222-8222-000000000128'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/resistance.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000129'::uuid, 'd2222222-d222-4222-8222-000000000129'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/sportsbottle.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000130'::uuid, 'd2222222-d222-4222-8222-000000000130'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/gymgloves.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000131'::uuid, 'd2222222-d222-4222-8222-000000000131'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/badminton.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000132'::uuid, 'd2222222-d222-4222-8222-000000000132'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/shuttlecock.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000133'::uuid, 'd2222222-d222-4222-8222-000000000133'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/compression.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000134'::uuid, 'd2222222-d222-4222-8222-000000000134'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/foamroller.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000135'::uuid, 'd2222222-d222-4222-8222-000000000135'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/sportscap.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000136'::uuid, 'd2222222-d222-4222-8222-000000000136'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/teddy.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000137'::uuid, 'd2222222-d222-4222-8222-000000000137'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/blocks.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000138'::uuid, 'd2222222-d222-4222-8222-000000000138'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/remotecar.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000139'::uuid, 'd2222222-d222-4222-8222-000000000139'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/puzzle.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000140'::uuid, 'd2222222-d222-4222-8222-000000000140'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/colouring.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000141'::uuid, 'd2222222-d222-4222-8222-000000000141'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/kidsfootball.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000142'::uuid, 'd2222222-d222-4222-8222-000000000142'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/doll.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000143'::uuid, 'd2222222-d222-4222-8222-000000000143'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/stacking.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000144'::uuid, 'd2222222-d222-4222-8222-000000000144'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/scooter.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000145'::uuid, 'd2222222-d222-4222-8222-000000000145'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/flashcards.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000146'::uuid, 'd2222222-d222-4222-8222-000000000146'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/bathtoys.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000147'::uuid, 'd2222222-d222-4222-8222-000000000147'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/lcdboard.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000148'::uuid, 'd2222222-d222-4222-8222-000000000148'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/bubblegun.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000149'::uuid, 'd2222222-d222-4222-8222-000000000149'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/elephant.svg', 0, true),
  ('d3333333-d333-4333-8333-000000000150'::uuid, 'd2222222-d222-4222-8222-000000000150'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/boardgame.svg', 0, true)
) as seed (id, product_id, storage_path, sort_order, is_primary)
where exists (select 1 from public.products as p where p.id = seed.product_id)
on conflict (id) do update set
  product_id = excluded.product_id,
  storage_path = excluded.storage_path,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary;

-- ---------------------------------------------------------------------------
-- Reels (30 published). video_path values are public sample MP4 placeholders
-- to be replaced by real Storage uploads later.
-- ---------------------------------------------------------------------------
insert into public.reels (
  id, vendor_id, caption, video_path, thumbnail_path, duration_seconds, status, created_at
) values
  ('d5555555-d555-4555-8555-000000000001', 'd1111111-d111-4111-8111-000000000001', 'Purush Lane: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/purush-lane-reel-1.svg', 15, 'published', now() - interval '1 days'),
  ('d5555555-d555-4555-8555-000000000002', 'd1111111-d111-4111-8111-000000000001', 'Purush Lane: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/purush-lane-reel-2.svg', 20, 'published', now() - interval '2 days'),
  ('d5555555-d555-4555-8555-000000000003', 'd1111111-d111-4111-8111-000000000001', 'Purush Lane: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/purush-lane-reel-3.svg', 25, 'published', now() - interval '3 days'),
  ('d5555555-d555-4555-8555-000000000004', 'd1111111-d111-4111-8111-000000000002', 'Nari Atelier: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/nari-atelier-reel-1.svg', 15, 'published', now() - interval '4 days'),
  ('d5555555-d555-4555-8555-000000000005', 'd1111111-d111-4111-8111-000000000002', 'Nari Atelier: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/nari-atelier-reel-2.svg', 20, 'published', now() - interval '5 days'),
  ('d5555555-d555-4555-8555-000000000006', 'd1111111-d111-4111-8111-000000000002', 'Nari Atelier: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/nari-atelier-reel-3.svg', 25, 'published', now() - interval '6 days'),
  ('d5555555-d555-4555-8555-000000000007', 'd1111111-d111-4111-8111-000000000003', 'Gadget Bazar BD: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/gadget-bazar-reel-1.svg', 15, 'published', now() - interval '7 days'),
  ('d5555555-d555-4555-8555-000000000008', 'd1111111-d111-4111-8111-000000000003', 'Gadget Bazar BD: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/gadget-bazar-reel-2.svg', 20, 'published', now() - interval '8 days'),
  ('d5555555-d555-4555-8555-000000000009', 'd1111111-d111-4111-8111-000000000003', 'Gadget Bazar BD: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/gadget-bazar-reel-3.svg', 25, 'published', now() - interval '9 days'),
  ('d5555555-d555-4555-8555-000000000010', 'd1111111-d111-4111-8111-000000000004', 'Case Corner: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/case-corner-reel-1.svg', 15, 'published', now() - interval '10 days'),
  ('d5555555-d555-4555-8555-000000000011', 'd1111111-d111-4111-8111-000000000004', 'Case Corner: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/case-corner-reel-2.svg', 20, 'published', now() - interval '11 days'),
  ('d5555555-d555-4555-8555-000000000012', 'd1111111-d111-4111-8111-000000000004', 'Case Corner: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/case-corner-reel-3.svg', 25, 'published', now() - interval '12 days'),
  ('d5555555-d555-4555-8555-000000000013', 'd1111111-d111-4111-8111-000000000005', 'Ghor O Ranna: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/ghor-o-ranna-reel-1.svg', 15, 'published', now() - interval '13 days'),
  ('d5555555-d555-4555-8555-000000000014', 'd1111111-d111-4111-8111-000000000005', 'Ghor O Ranna: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/ghor-o-ranna-reel-2.svg', 20, 'published', now() - interval '14 days'),
  ('d5555555-d555-4555-8555-000000000015', 'd1111111-d111-4111-8111-000000000005', 'Ghor O Ranna: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/ghor-o-ranna-reel-3.svg', 25, 'published', now() - interval '15 days'),
  ('d5555555-d555-4555-8555-000000000016', 'd1111111-d111-4111-8111-000000000006', 'Rupchaya Beauty: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/rupchaya-beauty-reel-1.svg', 15, 'published', now() - interval '16 days'),
  ('d5555555-d555-4555-8555-000000000017', 'd1111111-d111-4111-8111-000000000006', 'Rupchaya Beauty: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/rupchaya-beauty-reel-2.svg', 20, 'published', now() - interval '17 days'),
  ('d5555555-d555-4555-8555-000000000018', 'd1111111-d111-4111-8111-000000000006', 'Rupchaya Beauty: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/rupchaya-beauty-reel-3.svg', 25, 'published', now() - interval '18 days'),
  ('d5555555-d555-4555-8555-000000000019', 'd1111111-d111-4111-8111-000000000007', 'Bazaar Basket: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/bazaar-basket-reel-1.svg', 15, 'published', now() - interval '19 days'),
  ('d5555555-d555-4555-8555-000000000020', 'd1111111-d111-4111-8111-000000000007', 'Bazaar Basket: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/bazaar-basket-reel-2.svg', 20, 'published', now() - interval '20 days'),
  ('d5555555-d555-4555-8555-000000000021', 'd1111111-d111-4111-8111-000000000007', 'Bazaar Basket: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/bazaar-basket-reel-3.svg', 25, 'published', now() - interval '21 days'),
  ('d5555555-d555-4555-8555-000000000022', 'd1111111-d111-4111-8111-000000000008', 'Boighar Stationery: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/boighar-reel-1.svg', 15, 'published', now() - interval '22 days'),
  ('d5555555-d555-4555-8555-000000000023', 'd1111111-d111-4111-8111-000000000008', 'Boighar Stationery: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/boighar-reel-2.svg', 20, 'published', now() - interval '23 days'),
  ('d5555555-d555-4555-8555-000000000024', 'd1111111-d111-4111-8111-000000000008', 'Boighar Stationery: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/boighar-reel-3.svg', 25, 'published', now() - interval '24 days'),
  ('d5555555-d555-4555-8555-000000000025', 'd1111111-d111-4111-8111-000000000009', 'Khelaghar Fitness: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/khelaghar-reel-1.svg', 15, 'published', now() - interval '25 days'),
  ('d5555555-d555-4555-8555-000000000026', 'd1111111-d111-4111-8111-000000000009', 'Khelaghar Fitness: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/khelaghar-reel-2.svg', 20, 'published', now() - interval '26 days'),
  ('d5555555-d555-4555-8555-000000000027', 'd1111111-d111-4111-8111-000000000009', 'Khelaghar Fitness: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/khelaghar-reel-3.svg', 25, 'published', now() - interval '27 days'),
  ('d5555555-d555-4555-8555-000000000028', 'd1111111-d111-4111-8111-000000000010', 'Choto Bondhu Toys: look 1 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/choto-bondhu-reel-1.svg', 15, 'published', now() - interval '28 days'),
  ('d5555555-d555-4555-8555-000000000029', 'd1111111-d111-4111-8111-000000000010', 'Choto Bondhu Toys: look 2 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/choto-bondhu-reel-2.svg', 20, 'published', now() - interval '29 days'),
  ('d5555555-d555-4555-8555-000000000030', 'd1111111-d111-4111-8111-000000000010', 'Choto Bondhu Toys: look 3 / দেখুন নতুন কালেকশন', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/choto-bondhu-reel-3.svg', 25, 'published', now() - interval '30 days')
on conflict (id) do update set
  caption = excluded.caption,
  video_path = excluded.video_path,
  thumbnail_path = excluded.thumbnail_path,
  duration_seconds = excluded.duration_seconds,
  status = excluded.status;

-- ---------------------------------------------------------------------------
-- Reel ↔ product links (same shop only)
-- ---------------------------------------------------------------------------
insert into public.reel_products (id, reel_id, product_id, sort_order)
select seed.id, seed.reel_id, seed.product_id, seed.sort_order
from (values
  ('d6666666-d666-4666-8666-000000000001'::uuid, 'd5555555-d555-4555-8555-000000000001'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000002'::uuid, 'd5555555-d555-4555-8555-000000000002'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000003'::uuid, 'd5555555-d555-4555-8555-000000000002'::uuid, 'd2222222-d222-4222-8222-000000000002'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000004'::uuid, 'd5555555-d555-4555-8555-000000000003'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000005'::uuid, 'd5555555-d555-4555-8555-000000000003'::uuid, 'd2222222-d222-4222-8222-000000000002'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000006'::uuid, 'd5555555-d555-4555-8555-000000000003'::uuid, 'd2222222-d222-4222-8222-000000000003'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000007'::uuid, 'd5555555-d555-4555-8555-000000000004'::uuid, 'd2222222-d222-4222-8222-000000000016'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000008'::uuid, 'd5555555-d555-4555-8555-000000000005'::uuid, 'd2222222-d222-4222-8222-000000000016'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000009'::uuid, 'd5555555-d555-4555-8555-000000000005'::uuid, 'd2222222-d222-4222-8222-000000000017'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000010'::uuid, 'd5555555-d555-4555-8555-000000000006'::uuid, 'd2222222-d222-4222-8222-000000000016'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000011'::uuid, 'd5555555-d555-4555-8555-000000000006'::uuid, 'd2222222-d222-4222-8222-000000000017'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000012'::uuid, 'd5555555-d555-4555-8555-000000000006'::uuid, 'd2222222-d222-4222-8222-000000000018'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000013'::uuid, 'd5555555-d555-4555-8555-000000000007'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000014'::uuid, 'd5555555-d555-4555-8555-000000000008'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000015'::uuid, 'd5555555-d555-4555-8555-000000000008'::uuid, 'd2222222-d222-4222-8222-000000000032'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000016'::uuid, 'd5555555-d555-4555-8555-000000000009'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000017'::uuid, 'd5555555-d555-4555-8555-000000000009'::uuid, 'd2222222-d222-4222-8222-000000000032'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000018'::uuid, 'd5555555-d555-4555-8555-000000000009'::uuid, 'd2222222-d222-4222-8222-000000000033'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000019'::uuid, 'd5555555-d555-4555-8555-000000000010'::uuid, 'd2222222-d222-4222-8222-000000000046'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000020'::uuid, 'd5555555-d555-4555-8555-000000000011'::uuid, 'd2222222-d222-4222-8222-000000000046'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000021'::uuid, 'd5555555-d555-4555-8555-000000000011'::uuid, 'd2222222-d222-4222-8222-000000000047'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000022'::uuid, 'd5555555-d555-4555-8555-000000000012'::uuid, 'd2222222-d222-4222-8222-000000000046'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000023'::uuid, 'd5555555-d555-4555-8555-000000000012'::uuid, 'd2222222-d222-4222-8222-000000000047'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000024'::uuid, 'd5555555-d555-4555-8555-000000000012'::uuid, 'd2222222-d222-4222-8222-000000000048'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000025'::uuid, 'd5555555-d555-4555-8555-000000000013'::uuid, 'd2222222-d222-4222-8222-000000000061'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000026'::uuid, 'd5555555-d555-4555-8555-000000000014'::uuid, 'd2222222-d222-4222-8222-000000000061'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000027'::uuid, 'd5555555-d555-4555-8555-000000000014'::uuid, 'd2222222-d222-4222-8222-000000000062'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000028'::uuid, 'd5555555-d555-4555-8555-000000000015'::uuid, 'd2222222-d222-4222-8222-000000000061'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000029'::uuid, 'd5555555-d555-4555-8555-000000000015'::uuid, 'd2222222-d222-4222-8222-000000000062'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000030'::uuid, 'd5555555-d555-4555-8555-000000000015'::uuid, 'd2222222-d222-4222-8222-000000000063'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000031'::uuid, 'd5555555-d555-4555-8555-000000000016'::uuid, 'd2222222-d222-4222-8222-000000000076'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000032'::uuid, 'd5555555-d555-4555-8555-000000000017'::uuid, 'd2222222-d222-4222-8222-000000000076'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000033'::uuid, 'd5555555-d555-4555-8555-000000000017'::uuid, 'd2222222-d222-4222-8222-000000000077'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000034'::uuid, 'd5555555-d555-4555-8555-000000000018'::uuid, 'd2222222-d222-4222-8222-000000000076'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000035'::uuid, 'd5555555-d555-4555-8555-000000000018'::uuid, 'd2222222-d222-4222-8222-000000000077'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000036'::uuid, 'd5555555-d555-4555-8555-000000000018'::uuid, 'd2222222-d222-4222-8222-000000000078'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000037'::uuid, 'd5555555-d555-4555-8555-000000000019'::uuid, 'd2222222-d222-4222-8222-000000000091'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000038'::uuid, 'd5555555-d555-4555-8555-000000000020'::uuid, 'd2222222-d222-4222-8222-000000000091'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000039'::uuid, 'd5555555-d555-4555-8555-000000000020'::uuid, 'd2222222-d222-4222-8222-000000000092'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000040'::uuid, 'd5555555-d555-4555-8555-000000000021'::uuid, 'd2222222-d222-4222-8222-000000000091'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000041'::uuid, 'd5555555-d555-4555-8555-000000000021'::uuid, 'd2222222-d222-4222-8222-000000000092'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000042'::uuid, 'd5555555-d555-4555-8555-000000000021'::uuid, 'd2222222-d222-4222-8222-000000000093'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000043'::uuid, 'd5555555-d555-4555-8555-000000000022'::uuid, 'd2222222-d222-4222-8222-000000000106'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000044'::uuid, 'd5555555-d555-4555-8555-000000000023'::uuid, 'd2222222-d222-4222-8222-000000000106'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000045'::uuid, 'd5555555-d555-4555-8555-000000000023'::uuid, 'd2222222-d222-4222-8222-000000000107'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000046'::uuid, 'd5555555-d555-4555-8555-000000000024'::uuid, 'd2222222-d222-4222-8222-000000000106'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000047'::uuid, 'd5555555-d555-4555-8555-000000000024'::uuid, 'd2222222-d222-4222-8222-000000000107'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000048'::uuid, 'd5555555-d555-4555-8555-000000000024'::uuid, 'd2222222-d222-4222-8222-000000000108'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000049'::uuid, 'd5555555-d555-4555-8555-000000000025'::uuid, 'd2222222-d222-4222-8222-000000000121'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000050'::uuid, 'd5555555-d555-4555-8555-000000000026'::uuid, 'd2222222-d222-4222-8222-000000000121'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000051'::uuid, 'd5555555-d555-4555-8555-000000000026'::uuid, 'd2222222-d222-4222-8222-000000000122'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000052'::uuid, 'd5555555-d555-4555-8555-000000000027'::uuid, 'd2222222-d222-4222-8222-000000000121'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000053'::uuid, 'd5555555-d555-4555-8555-000000000027'::uuid, 'd2222222-d222-4222-8222-000000000122'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000054'::uuid, 'd5555555-d555-4555-8555-000000000027'::uuid, 'd2222222-d222-4222-8222-000000000123'::uuid, 2),
  ('d6666666-d666-4666-8666-000000000055'::uuid, 'd5555555-d555-4555-8555-000000000028'::uuid, 'd2222222-d222-4222-8222-000000000136'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000056'::uuid, 'd5555555-d555-4555-8555-000000000029'::uuid, 'd2222222-d222-4222-8222-000000000136'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000057'::uuid, 'd5555555-d555-4555-8555-000000000029'::uuid, 'd2222222-d222-4222-8222-000000000137'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000058'::uuid, 'd5555555-d555-4555-8555-000000000030'::uuid, 'd2222222-d222-4222-8222-000000000136'::uuid, 0),
  ('d6666666-d666-4666-8666-000000000059'::uuid, 'd5555555-d555-4555-8555-000000000030'::uuid, 'd2222222-d222-4222-8222-000000000137'::uuid, 1),
  ('d6666666-d666-4666-8666-000000000060'::uuid, 'd5555555-d555-4555-8555-000000000030'::uuid, 'd2222222-d222-4222-8222-000000000138'::uuid, 2)
) as seed (id, reel_id, product_id, sort_order)
where exists (select 1 from public.reels as r where r.id = seed.reel_id)
  and exists (select 1 from public.products as p where p.id = seed.product_id)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Live streams (2). livekit_room_name is a demo room string, not a secret.
-- ---------------------------------------------------------------------------
insert into public.live_streams (
  id, vendor_id, title, description, thumbnail_url, status, livekit_room_name,
  scheduled_at, started_at, ended_at, pinned_product_id, created_at
) values
  ('d7777777-d777-4777-8777-000000000001', 'd1111111-d111-4111-8111-000000000001', 'Purush Lane Friday Drop', 'Live try-on of new panjabi and sneakers.',
   'https://picsum.photos/seed/demo-live-1/1280/720', 'scheduled', 'demo-live-room-1',
   now() + interval '2 days', null, null, 'd2222222-d222-4222-8222-000000000001', now()),
  ('d7777777-d777-4777-8777-000000000002', 'd1111111-d111-4111-8111-000000000003', 'Gadget Night Ended Replay', 'Phone deals night — ended demo stream.',
   'https://picsum.photos/seed/demo-live-2/1280/720', 'ended', 'demo-live-room-2',
   now() - interval '5 days', now() - interval '5 days', now() - interval '5 days' + interval '90 minutes',
   'd2222222-d222-4222-8222-000000000031', now() - interval '5 days')
on conflict (id) do nothing;

insert into public.live_stream_products (id, stream_id, product_id, sort_order)
select seed.id, seed.stream_id, seed.product_id, seed.sort_order
from (values
  ('d8888888-d888-4888-8888-000000000001'::uuid, 'd7777777-d777-4777-8777-000000000001'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid, 0),
  ('d8888888-d888-4888-8888-000000000002'::uuid, 'd7777777-d777-4777-8777-000000000001'::uuid, 'd2222222-d222-4222-8222-000000000002'::uuid, 1),
  ('d8888888-d888-4888-8888-000000000003'::uuid, 'd7777777-d777-4777-8777-000000000001'::uuid, 'd2222222-d222-4222-8222-000000000003'::uuid, 2),
  ('d8888888-d888-4888-8888-000000000004'::uuid, 'd7777777-d777-4777-8777-000000000002'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid, 0),
  ('d8888888-d888-4888-8888-000000000005'::uuid, 'd7777777-d777-4777-8777-000000000002'::uuid, 'd2222222-d222-4222-8222-000000000032'::uuid, 1),
  ('d8888888-d888-4888-8888-000000000006'::uuid, 'd7777777-d777-4777-8777-000000000002'::uuid, 'd2222222-d222-4222-8222-000000000033'::uuid, 2)
) as seed (id, stream_id, product_id, sort_order)
where exists (select 1 from public.live_streams as s where s.id = seed.stream_id)
on conflict (id) do nothing;

commit;

-- Summary
select
  (select count(*) from public.vendor_profiles
    where profile_id between 'd1111111-d111-4111-8111-000000000001'
                        and 'd1111111-d111-4111-8111-000000000010') as demo_shops,
  (select count(*) from public.categories
    where id::text like 'd4444444-%') as demo_categories_added,
  (select count(*) from public.products
    where id between 'd2222222-d222-4222-8222-000000000001'
                and 'd2222222-d222-4222-8222-000000000150') as demo_products,
  (select count(*) from public.product_images
    where id between 'd3333333-d333-4333-8333-000000000001'
                and 'd3333333-d333-4333-8333-000000000525') as demo_product_images,
  (select count(*) from public.reels
    where id between 'd5555555-d555-4555-8555-000000000001'
                and 'd5555555-d555-4555-8555-000000000030') as demo_reels,
  (select count(*) from public.reel_products
    where id between 'd6666666-d666-4666-8666-000000000001'
                and 'd6666666-d666-4666-8666-000000000060') as demo_reel_product_links;
