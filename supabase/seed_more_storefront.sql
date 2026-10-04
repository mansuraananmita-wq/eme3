-- Extra catalog rows and upcoming lives for the storefront.
-- Safe to run more than once. Uses the demo shops already in seed_demo.sql.

insert into public.products (
  id, vendor_id, category_id, title, slug, description,
  price, compare_at_price, currency, stock, sku, status, created_at
)
select
  seed.id, seed.vendor_id, category.id, seed.title, seed.slug, seed.description,
  seed.price, seed.compare_at_price, 'BDT', seed.stock, seed.sku,
  'active'::public.product_status, now() - seed.age
from (values
  ('d2222222-d222-4222-8222-000000000151'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Niacinamide Serum 30ml', 'demo-extra-serum-30', 'Daily serum for uneven tone.', 719.00, 899.00, 48, 'DM-X-B01', interval '2 days'),
  ('d2222222-d222-4222-8222-000000000152'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Salicylic Toner 110ml', 'demo-extra-toner-110', 'Clarifying toner for oily skin.', 639.00, 799.00, 40, 'DM-X-B02', interval '3 days'),
  ('d2222222-d222-4222-8222-000000000153'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Glycolic Toner 7%', 'demo-extra-glycolic', 'Pore-refining toner.', 559.00, 699.00, 36, 'DM-X-B03', interval '4 days'),
  ('d2222222-d222-4222-8222-000000000154'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'skincare', 'Ceramide Moisturizer 50ml', 'demo-extra-cream-50', 'Barrier cream for dry skin.', 543.00, 679.00, 52, 'DM-X-B04', interval '5 days'),
  ('d2222222-d222-4222-8222-000000000155'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Non-stick Cookware Set 7pc', 'demo-extra-cookset-7', 'Everyday pots and a fry pan.', 4996.00, 6490.00, 12, 'DM-X-K01', interval '1 days'),
  ('d2222222-d222-4222-8222-000000000156'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Induction Cookware Set 8pc', 'demo-extra-induction-8', 'Heavy base set for induction.', 5056.00, 6990.00, 9, 'DM-X-K02', interval '6 days'),
  ('d2222222-d222-4222-8222-000000000157'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'kitchen', 'Casserole Set 3pc', 'demo-extra-casserole', 'Oven-safe casseroles with lids.', 3996.00, 5490.00, 11, 'DM-X-K03', interval '8 days'),
  ('d2222222-d222-4222-8222-000000000158'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'Smart Watch Sport', 'demo-extra-watch-sport', 'Heart rate, steps, and alerts.', 3490.00, 4990.00, 20, 'DM-X-E01', interval '1 days'),
  ('d2222222-d222-4222-8222-000000000159'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'electronics-accessories', 'Air Fryer 4L', 'demo-extra-airfryer', 'Compact air fryer for small kitchens.', 4590.00, 5990.00, 14, 'DM-X-E02', interval '2 days'),
  ('d2222222-d222-4222-8222-000000000160'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Polo Shirt Pack', 'demo-extra-polo', 'Two cotton polos for everyday wear.', 1890.00, 2400.00, 30, 'DM-X-M01', interval '3 days'),
  ('d2222222-d222-4222-8222-000000000161'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'womens-clothing', 'Face Wash Duo', 'demo-extra-facewash', 'Gentle cleanser, two bottles.', 690.00, 890.00, 44, 'DM-X-W01', interval '4 days'),
  ('d2222222-d222-4222-8222-000000000162'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'chargers', '65W GaN Charger', 'demo-extra-gan-65', 'Laptop and phone charger in one brick.', 1890.00, 2490.00, 26, 'DM-X-C01', interval '5 days')
) as seed(id, vendor_id, category_slug, title, slug, description, price, compare_at_price, stock, sku, age)
join public.categories as category on category.slug = seed.category_slug
on conflict (slug) do nothing;

insert into public.product_images (id, product_id, storage_path, sort_order, is_primary)
select seed.id, seed.product_id, seed.storage_path, 0, true
from (values
  ('d3333333-d333-4333-8333-000000000151'::uuid, 'd2222222-d222-4222-8222-000000000151'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/serum.svg'),
  ('d3333333-d333-4333-8333-000000000152'::uuid, 'd2222222-d222-4222-8222-000000000152'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/serum.svg'),
  ('d3333333-d333-4333-8333-000000000153'::uuid, 'd2222222-d222-4222-8222-000000000153'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/hairserum.svg'),
  ('d3333333-d333-4333-8333-000000000154'::uuid, 'd2222222-d222-4222-8222-000000000154'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/serum.svg'),
  ('d3333333-d333-4333-8333-000000000155'::uuid, 'd2222222-d222-4222-8222-000000000155'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/frypan.svg'),
  ('d3333333-d333-4333-8333-000000000156'::uuid, 'd2222222-d222-4222-8222-000000000156'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/frypan.svg'),
  ('d3333333-d333-4333-8333-000000000157'::uuid, 'd2222222-d222-4222-8222-000000000157'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/frypan.svg'),
  ('d3333333-d333-4333-8333-000000000158'::uuid, 'd2222222-d222-4222-8222-000000000158'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/smartwatch.svg'),
  ('d3333333-d333-4333-8333-000000000159'::uuid, 'd2222222-d222-4222-8222-000000000159'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/kettle.svg'),
  ('d3333333-d333-4333-8333-000000000160'::uuid, 'd2222222-d222-4222-8222-000000000160'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/shirt.svg'),
  ('d3333333-d333-4333-8333-000000000161'::uuid, 'd2222222-d222-4222-8222-000000000161'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/serum.svg'),
  ('d3333333-d333-4333-8333-000000000162'::uuid, 'd2222222-d222-4222-8222-000000000162'::uuid, 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/charger.svg')
) as seed(id, product_id, storage_path)
where exists (select 1 from public.products as p where p.id = seed.product_id)
on conflict (id) do nothing;

update public.live_streams
set scheduled_at = now() + interval '1 day',
    status = 'scheduled',
    started_at = null,
    ended_at = null
where id = 'd7777777-d777-4777-8777-000000000001';

insert into public.live_streams (
  id, vendor_id, title, description, thumbnail_url, status, livekit_room_name,
  scheduled_at, pinned_product_id, created_at
)
select seed.id, seed.vendor_id, seed.title, seed.description, seed.thumbnail_url,
  'scheduled'::public.live_status, seed.room, now() + seed.when_in, seed.product_id, now()
from (values
  ('d7777777-d777-4777-8777-000000000003'::uuid, 'd1111111-d111-4111-8111-000000000006'::uuid, 'Beauty shelf live', 'Serums and creams, questions welcome.', 'https://picsum.photos/seed/demo-live-3/1280/720', 'demo-live-room-3', interval '6 hours', 'd2222222-d222-4222-8222-000000000076'::uuid),
  ('d7777777-d777-4777-8777-000000000004'::uuid, 'd1111111-d111-4111-8111-000000000005'::uuid, 'Kitchen set walkthrough', 'Cookware sets for the week.', 'https://picsum.photos/seed/demo-live-4/1280/720', 'demo-live-room-4', interval '1 day', 'd2222222-d222-4222-8222-000000000063'::uuid),
  ('d7777777-d777-4777-8777-000000000005'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'Gadget hour', 'Watches, earbuds, and chargers.', 'https://picsum.photos/seed/demo-live-5/1280/720', 'demo-live-room-5', interval '2 days', 'd2222222-d222-4222-8222-000000000037'::uuid)
) as seed(id, vendor_id, title, description, thumbnail_url, room, when_in, product_id)
where exists (select 1 from public.vendor_profiles as shop where shop.profile_id = seed.vendor_id)
on conflict (id) do nothing;
