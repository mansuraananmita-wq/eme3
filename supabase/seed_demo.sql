-- seed_demo.sql
-- Demo catalog for frontend testing. Run once in the Supabase SQL editor as postgres.
-- Requires: migrations 0001-0019 and supabase/seed.sql (categories).
-- Idempotent. Commits. Does not disable triggers or foreign keys.
-- Demo vendors cannot sign in (no usable password).

-- Fixed demo vendor auth user ids.
--   d1111111-d111-4111-8111-000000000001 .. 0004
-- Products: d2222222-d222-4222-8222-000000000001 .. 0040
-- Images:  d3333333-d333-4333-8333-000000000001 .. 0120

begin;

-- ---------------------------------------------------------------------------
-- Auth users (password is a throwaway bcrypt of random bytes; plaintext is discarded)
-- ---------------------------------------------------------------------------
do $$
declare
  person record;
begin
  for person in
    select *
    from (
      values
        (
          'd1111111-d111-4111-8111-000000000001'::uuid,
          'demo-vendor-1@eme.demo',
          'Style Lane Owner'
        ),
        (
          'd1111111-d111-4111-8111-000000000002'::uuid,
          'demo-vendor-2@eme.demo',
          'Tech Hub Owner'
        ),
        (
          'd1111111-d111-4111-8111-000000000003'::uuid,
          'demo-vendor-3@eme.demo',
          'Home Nest Owner'
        ),
        (
          'd1111111-d111-4111-8111-000000000004'::uuid,
          'demo-vendor-4@eme.demo',
          'Glow Lab Owner'
        )
    ) as t (id, email, full_name)
  loop
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      person.id,
      'authenticated',
      'authenticated',
      person.email,
      -- Unusable: bcrypt of random bytes; the plaintext is never stored.
      extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
      null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', person.full_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do nothing;

    begin
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        person.id,
        person.id,
        jsonb_build_object('sub', person.id::text, 'email', person.email),
        'email',
        person.id::text,
        now(),
        now(),
        now()
      )
      on conflict do nothing;
    exception
      when others then
        null;
    end;
  end loop;
end;
$$;

-- Trigger handle_new_user creates customer profiles. Promote to vendor (SQL editor is postgres).
update public.profiles
set
  role = 'vendor',
  full_name = coalesce(full_name, 'Demo Vendor')
where id in (
  'd1111111-d111-4111-8111-000000000001',
  'd1111111-d111-4111-8111-000000000002',
  'd1111111-d111-4111-8111-000000000003',
  'd1111111-d111-4111-8111-000000000004'
);

-- ---------------------------------------------------------------------------
-- Approved shops
-- ---------------------------------------------------------------------------
insert into public.vendor_profiles (
  profile_id, shop_name, slug, description, logo_url, banner_url, status
) values
  (
    'd1111111-d111-4111-8111-000000000001',
    'Style Lane',
    'demo-style-lane',
    'ফ্যাশন ও পোশাক। Everyday fashion for men, women, and kids.',
    'https://picsum.photos/seed/demo-style-lane-logo/200/200',
    'https://picsum.photos/seed/demo-style-lane-banner/1200/400',
    'approved'
  ),
  (
    'd1111111-d111-4111-8111-000000000002',
    'Tech Hub',
    'demo-tech-hub',
    'ইলেকট্রনিক্স ও গ্যাজেট। Phones, laptops, and accessories.',
    'https://picsum.photos/seed/demo-tech-hub-logo/200/200',
    'https://picsum.photos/seed/demo-tech-hub-banner/1200/400',
    'approved'
  ),
  (
    'd1111111-d111-4111-8111-000000000003',
    'Home Nest',
    'demo-home-nest',
    'ঘর ও রান্নাঘর। Furniture, kitchen tools, and decor.',
    'https://picsum.photos/seed/demo-home-nest-logo/200/200',
    'https://picsum.photos/seed/demo-home-nest-banner/1200/400',
    'approved'
  ),
  (
    'd1111111-d111-4111-8111-000000000004',
    'Glow Lab',
    'demo-glow-lab',
    'সৌন্দর্য ও যত্ন। Skincare, makeup, and hair care.',
    'https://picsum.photos/seed/demo-glow-lab-logo/200/200',
    'https://picsum.photos/seed/demo-glow-lab-banner/1200/400',
    'approved'
  )
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- Products (40 active). Category ids come from seed.sql by slug.
-- ---------------------------------------------------------------------------
insert into public.products (
  id, vendor_id, category_id, title, slug, description,
  price, compare_at_price, currency, stock, sku, status
)
select
  seed.id,
  seed.vendor_id,
  category.id,
  seed.title,
  seed.slug,
  seed.description,
  seed.price,
  seed.compare_at_price,
  'BDT',
  seed.stock,
  seed.sku,
  'active'::public.product_status
from (
  values
    -- Style Lane (fashion) — 10
    ('d2222222-d222-4222-8222-000000000001'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Cotton Panjabi / সুতি পাঞ্জাবি', 'demo-cotton-panjabi', 'Lightweight cotton panjabi for Eid and Friday prayers.', 1890.00, 2490.00, 40, 'SL-PANJ-01'),
    ('d2222222-d222-4222-8222-000000000002'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-clothing', 'Slim Fit Jeans', 'demo-slim-fit-jeans', 'Stretch denim, mid wash. Daily wear jeans.', 2200.00, 2800.00, 25, 'SL-JEAN-02'),
    ('d2222222-d222-4222-8222-000000000003'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-footwear', 'Leather Sandals / চামড়ার স্যান্ডেল', 'demo-leather-sandals', 'Hand-finished leather sandals for warm weather.', 1450.00, null, 18, 'SL-SAND-03'),
    ('d2222222-d222-4222-8222-000000000004'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'womens-clothing', 'Cotton Salwar Kameez', 'demo-salwar-kameez', 'Three-piece cotton set with soft dupatta.', 2650.00, 3200.00, 30, 'SL-SALW-04'),
    ('d2222222-d222-4222-8222-000000000005'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'womens-clothing', 'Linen Kurti / লিনেন কুর্তি', 'demo-linen-kurti', 'Breathable linen kurti for office and weekend.', 1590.00, 1990.00, 0, 'SL-KURT-05'),
    ('d2222222-d222-4222-8222-000000000006'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'womens-footwear', 'Block Heel Sandals', 'demo-block-heel-sandals', 'Comfort block heel, 2 inch. Black and nude.', 2100.00, 2600.00, 12, 'SL-HEEL-06'),
    ('d2222222-d222-4222-8222-000000000007'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'boys', 'Boys Polo Shirt', 'demo-boys-polo', 'Soft jersey polo for ages 6–12.', 890.00, 1100.00, 45, 'SL-POLO-07'),
    ('d2222222-d222-4222-8222-000000000008'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'girls', 'Girls Frock / মেয়েদের ফ্রক', 'demo-girls-frock', 'Printed cotton frock with bow detail.', 1250.00, 1500.00, 22, 'SL-FROC-08'),
    ('d2222222-d222-4222-8222-000000000009'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'mens-footwear', 'Canvas Sneakers', 'demo-canvas-sneakers', 'Everyday white sneakers with rubber sole.', 1750.00, null, 8, 'SL-SNEK-09'),
    ('d2222222-d222-4222-8222-000000000010'::uuid, 'd1111111-d111-4111-8111-000000000001'::uuid, 'womens-clothing', 'Hijab Jersey Set', 'demo-hijab-jersey', 'Soft jersey hijab, two-pack. Neutral colours.', 690.00, 850.00, 60, 'SL-HIJA-10'),

    -- Tech Hub (electronics) — 10
    ('d2222222-d222-4222-8222-000000000011'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'smartphones', 'Android Phone 128GB', 'demo-android-phone-128', '৬.৫ ইঞ্চি ডিসপ্লে, ৫০MP ক্যামেরা। Mid-range Android phone.', 24990.00, 27990.00, 15, 'TH-PHON-11'),
    ('d2222222-d222-4222-8222-000000000012'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'smartphones', 'Budget Smartphone 64GB', 'demo-budget-phone-64', 'Reliable dual-SIM phone for everyday calls and apps.', 12990.00, 14990.00, 28, 'TH-PHON-12'),
    ('d2222222-d222-4222-8222-000000000013'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'feature-phones', 'Feature Phone / বাটন মোবাইল', 'demo-feature-phone', 'Long battery, torch, FM radio. Dual SIM.', 1890.00, null, 50, 'TH-FEAT-13'),
    ('d2222222-d222-4222-8222-000000000014'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'ultrabooks', '14" Ultrabook i5', 'demo-ultrabook-i5', 'Thin laptop, 16GB RAM, 512GB SSD. Office and study.', 72990.00, 79990.00, 6, 'TH-ULTB-14'),
    ('d2222222-d222-4222-8222-000000000015'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'gaming-laptops', 'Gaming Laptop RTX', 'demo-gaming-laptop-rtx', '144Hz screen, dedicated GPU. For games and design.', 129990.00, 139990.00, 0, 'TH-GAME-15'),
    ('d2222222-d222-4222-8222-000000000016'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'chargers', '20W USB-C Fast Charger', 'demo-usbc-charger-20w', 'PD charger with 1m cable. Phone and earbud friendly.', 890.00, 1200.00, 80, 'TH-CHAR-16'),
    ('d2222222-d222-4222-8222-000000000017'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'chargers', 'Power Bank 20000mAh', 'demo-power-bank-20k', 'দুই পোর্ট পাওয়ার ব্যাংক। Dual USB output.', 1890.00, 2290.00, 35, 'TH-POWR-17'),
    ('d2222222-d222-4222-8222-000000000018'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'cases-and-covers', 'Clear Phone Case', 'demo-clear-phone-case', 'Shock-absorb corners. Fits popular mid-range phones.', 450.00, 650.00, 100, 'TH-CASE-18'),
    ('d2222222-d222-4222-8222-000000000019'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'cases-and-covers', 'Silicone Case Pack', 'demo-silicone-case-pack', 'Matte silicone case, three colours in one pack.', 990.00, null, 40, 'TH-CASE-19'),
    ('d2222222-d222-4222-8222-000000000020'::uuid, 'd1111111-d111-4111-8111-000000000002'::uuid, 'ultrabooks', 'Wireless Mouse', 'demo-wireless-mouse', 'Silent click mouse with USB receiver.', 690.00, 850.00, 55, 'TH-MOUS-20'),

    -- Home Nest — 10
    ('d2222222-d222-4222-8222-000000000021'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'furniture', 'Study Table / পড়ার টেবিল', 'demo-study-table', 'Compact wooden study table with drawer.', 6500.00, 7500.00, 9, 'HN-TABL-21'),
    ('d2222222-d222-4222-8222-000000000022'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'furniture', 'Folding Chair', 'demo-folding-chair', 'Metal folding chair for guests and balcony.', 1850.00, null, 20, 'HN-CHAI-22'),
    ('d2222222-d222-4222-8222-000000000023'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'kitchen', 'Non-stick Fry Pan 24cm', 'demo-fry-pan-24', 'নাসটিক ফ্রাইপ্যান। Even heat, easy clean.', 1290.00, 1600.00, 40, 'HN-PANS-23'),
    ('d2222222-d222-4222-8222-000000000024'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'kitchen', 'Pressure Cooker 5L', 'demo-pressure-cooker-5l', 'Aluminium pressure cooker with safety valve.', 3200.00, 3800.00, 14, 'HN-COOK-24'),
    ('d2222222-d222-4222-8222-000000000025'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'kitchen', 'Spice Jar Set / মসলার জার', 'demo-spice-jar-set', '12 glass jars with labels and stand.', 1450.00, 1800.00, 0, 'HN-SPIC-25'),
    ('d2222222-d222-4222-8222-000000000026'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'decor', 'Wall Clock Minimal', 'demo-wall-clock', 'Silent quartz wall clock, 30cm.', 990.00, 1250.00, 25, 'HN-CLOK-26'),
    ('d2222222-d222-4222-8222-000000000027'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'decor', 'Cotton Cushion Cover', 'demo-cushion-cover', 'Set of 2 printed cushion covers, 16x16.', 750.00, null, 48, 'HN-CUSH-27'),
    ('d2222222-d222-4222-8222-000000000028'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'decor', 'Table Lamp / টেবিল ল্যাম্প', 'demo-table-lamp', 'Warm LED table lamp with fabric shade.', 1890.00, 2300.00, 16, 'HN-LAMP-28'),
    ('d2222222-d222-4222-8222-000000000029'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'furniture', 'Shoe Rack 3 Tier', 'demo-shoe-rack', 'Open shoe rack for hallway storage.', 2100.00, 2600.00, 11, 'HN-SHOE-29'),
    ('d2222222-d222-4222-8222-000000000030'::uuid, 'd1111111-d111-4111-8111-000000000003'::uuid, 'kitchen', 'Water Bottle Set 1L', 'demo-water-bottle-set', 'Tritan bottles, BPA free, pack of 3.', 990.00, 1200.00, 70, 'HN-BTTL-30'),

    -- Glow Lab (beauty) — 10
    ('d2222222-d222-4222-8222-000000000031'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'skincare', 'Vitamin C Serum 30ml', 'demo-vitamin-c-serum', 'Brightening serum for dull skin. Morning use.', 1450.00, 1800.00, 32, 'GL-SERU-31'),
    ('d2222222-d222-4222-8222-000000000032'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'skincare', 'Aloe Face Wash / অ্যালো ফেস ওয়াশ', 'demo-aloe-face-wash', 'Gentle gel cleanser for oily and combination skin.', 590.00, 750.00, 55, 'GL-FACE-32'),
    ('d2222222-d222-4222-8222-000000000033'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'skincare', 'SPF 50 Sunscreen', 'demo-spf50-sunscreen', 'Lightweight sunscreen, no white cast.', 890.00, null, 40, 'GL-SUNS-33'),
    ('d2222222-d222-4222-8222-000000000034'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'makeup', 'Matte Lipstick Set', 'demo-matte-lipstick-set', 'Three everyday shades. Long wear formula.', 1290.00, 1600.00, 24, 'GL-LIPS-34'),
    ('d2222222-d222-4222-8222-000000000035'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'makeup', 'Kajal Pencil / কাজল', 'demo-kajal-pencil', 'Smudge-resistant black kajal.', 350.00, 450.00, 90, 'GL-KAJA-35'),
    ('d2222222-d222-4222-8222-000000000036'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'makeup', 'Compact Powder', 'demo-compact-powder', 'Oil-control compact with mirror.', 780.00, 950.00, 0, 'GL-POWD-36'),
    ('d2222222-d222-4222-8222-000000000037'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'hair', 'Coconut Hair Oil 200ml', 'demo-coconut-hair-oil', 'নারকেল তেল। Cold-pressed coconut oil for hair.', 420.00, null, 75, 'GL-OIL-37'),
    ('d2222222-d222-4222-8222-000000000038'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'hair', 'Anti-Dandruff Shampoo', 'demo-anti-dandruff-shampoo', 'Cooling menthol shampoo, 340ml.', 690.00, 850.00, 38, 'GL-SHAM-38'),
    ('d2222222-d222-4222-8222-000000000039'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'hair', 'Hair Serum Shine', 'demo-hair-serum', 'Frizz control serum for humid weather.', 990.00, 1250.00, 20, 'GL-SERH-39'),
    ('d2222222-d222-4222-8222-000000000040'::uuid, 'd1111111-d111-4111-8111-000000000004'::uuid, 'skincare', 'Night Cream 50g', 'demo-night-cream', 'Nourishing night cream with shea butter.', 1150.00, 1400.00, 18, 'GL-NITE-40')
) as seed (
  id, vendor_id, category_slug, title, slug, description,
  price, compare_at_price, stock, sku
)
join public.categories as category
  on category.slug = seed.category_slug
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Product images (2–4 per product). storage_path accepts full public URLs.
-- ---------------------------------------------------------------------------
insert into public.product_images (
  id, product_id, storage_path, sort_order, is_primary
)
select
  seed.id,
  seed.product_id,
  seed.storage_path,
  seed.sort_order,
  seed.is_primary
from (
  values
    -- product 1
    ('d3333333-d333-4333-8333-000000000001'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid, 'https://picsum.photos/seed/demo-cotton-panjabi-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000002'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid, 'https://picsum.photos/seed/demo-cotton-panjabi-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000003'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid, 'https://picsum.photos/seed/demo-cotton-panjabi-3/800/800', 2, false),
    -- 2
    ('d3333333-d333-4333-8333-000000000004'::uuid, 'd2222222-d222-4222-8222-000000000002'::uuid, 'https://picsum.photos/seed/demo-slim-fit-jeans-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000005'::uuid, 'd2222222-d222-4222-8222-000000000002'::uuid, 'https://picsum.photos/seed/demo-slim-fit-jeans-2/800/800', 1, false),
    -- 3
    ('d3333333-d333-4333-8333-000000000006'::uuid, 'd2222222-d222-4222-8222-000000000003'::uuid, 'https://picsum.photos/seed/demo-leather-sandals-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000007'::uuid, 'd2222222-d222-4222-8222-000000000003'::uuid, 'https://picsum.photos/seed/demo-leather-sandals-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000008'::uuid, 'd2222222-d222-4222-8222-000000000003'::uuid, 'https://picsum.photos/seed/demo-leather-sandals-3/800/800', 2, false),
    -- 4
    ('d3333333-d333-4333-8333-000000000009'::uuid, 'd2222222-d222-4222-8222-000000000004'::uuid, 'https://picsum.photos/seed/demo-salwar-kameez-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000010'::uuid, 'd2222222-d222-4222-8222-000000000004'::uuid, 'https://picsum.photos/seed/demo-salwar-kameez-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000011'::uuid, 'd2222222-d222-4222-8222-000000000004'::uuid, 'https://picsum.photos/seed/demo-salwar-kameez-3/800/800', 2, false),
    ('d3333333-d333-4333-8333-000000000012'::uuid, 'd2222222-d222-4222-8222-000000000004'::uuid, 'https://picsum.photos/seed/demo-salwar-kameez-4/800/800', 3, false),
    -- 5
    ('d3333333-d333-4333-8333-000000000013'::uuid, 'd2222222-d222-4222-8222-000000000005'::uuid, 'https://picsum.photos/seed/demo-linen-kurti-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000014'::uuid, 'd2222222-d222-4222-8222-000000000005'::uuid, 'https://picsum.photos/seed/demo-linen-kurti-2/800/800', 1, false),
    -- 6
    ('d3333333-d333-4333-8333-000000000015'::uuid, 'd2222222-d222-4222-8222-000000000006'::uuid, 'https://picsum.photos/seed/demo-block-heel-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000016'::uuid, 'd2222222-d222-4222-8222-000000000006'::uuid, 'https://picsum.photos/seed/demo-block-heel-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000017'::uuid, 'd2222222-d222-4222-8222-000000000006'::uuid, 'https://picsum.photos/seed/demo-block-heel-3/800/800', 2, false),
    -- 7
    ('d3333333-d333-4333-8333-000000000018'::uuid, 'd2222222-d222-4222-8222-000000000007'::uuid, 'https://picsum.photos/seed/demo-boys-polo-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000019'::uuid, 'd2222222-d222-4222-8222-000000000007'::uuid, 'https://picsum.photos/seed/demo-boys-polo-2/800/800', 1, false),
    -- 8
    ('d3333333-d333-4333-8333-000000000020'::uuid, 'd2222222-d222-4222-8222-000000000008'::uuid, 'https://picsum.photos/seed/demo-girls-frock-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000021'::uuid, 'd2222222-d222-4222-8222-000000000008'::uuid, 'https://picsum.photos/seed/demo-girls-frock-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000022'::uuid, 'd2222222-d222-4222-8222-000000000008'::uuid, 'https://picsum.photos/seed/demo-girls-frock-3/800/800', 2, false),
    -- 9
    ('d3333333-d333-4333-8333-000000000023'::uuid, 'd2222222-d222-4222-8222-000000000009'::uuid, 'https://picsum.photos/seed/demo-canvas-sneakers-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000024'::uuid, 'd2222222-d222-4222-8222-000000000009'::uuid, 'https://picsum.photos/seed/demo-canvas-sneakers-2/800/800', 1, false),
    -- 10
    ('d3333333-d333-4333-8333-000000000025'::uuid, 'd2222222-d222-4222-8222-000000000010'::uuid, 'https://picsum.photos/seed/demo-hijab-jersey-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000026'::uuid, 'd2222222-d222-4222-8222-000000000010'::uuid, 'https://picsum.photos/seed/demo-hijab-jersey-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000027'::uuid, 'd2222222-d222-4222-8222-000000000010'::uuid, 'https://picsum.photos/seed/demo-hijab-jersey-3/800/800', 2, false),
    -- 11
    ('d3333333-d333-4333-8333-000000000028'::uuid, 'd2222222-d222-4222-8222-000000000011'::uuid, 'https://picsum.photos/seed/demo-android-phone-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000029'::uuid, 'd2222222-d222-4222-8222-000000000011'::uuid, 'https://picsum.photos/seed/demo-android-phone-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000030'::uuid, 'd2222222-d222-4222-8222-000000000011'::uuid, 'https://picsum.photos/seed/demo-android-phone-3/800/800', 2, false),
    ('d3333333-d333-4333-8333-000000000031'::uuid, 'd2222222-d222-4222-8222-000000000011'::uuid, 'https://picsum.photos/seed/demo-android-phone-4/800/800', 3, false),
    -- 12
    ('d3333333-d333-4333-8333-000000000032'::uuid, 'd2222222-d222-4222-8222-000000000012'::uuid, 'https://picsum.photos/seed/demo-budget-phone-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000033'::uuid, 'd2222222-d222-4222-8222-000000000012'::uuid, 'https://picsum.photos/seed/demo-budget-phone-2/800/800', 1, false),
    -- 13
    ('d3333333-d333-4333-8333-000000000034'::uuid, 'd2222222-d222-4222-8222-000000000013'::uuid, 'https://picsum.photos/seed/demo-feature-phone-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000035'::uuid, 'd2222222-d222-4222-8222-000000000013'::uuid, 'https://picsum.photos/seed/demo-feature-phone-2/800/800', 1, false),
    -- 14
    ('d3333333-d333-4333-8333-000000000036'::uuid, 'd2222222-d222-4222-8222-000000000014'::uuid, 'https://picsum.photos/seed/demo-ultrabook-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000037'::uuid, 'd2222222-d222-4222-8222-000000000014'::uuid, 'https://picsum.photos/seed/demo-ultrabook-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000038'::uuid, 'd2222222-d222-4222-8222-000000000014'::uuid, 'https://picsum.photos/seed/demo-ultrabook-3/800/800', 2, false),
    -- 15
    ('d3333333-d333-4333-8333-000000000039'::uuid, 'd2222222-d222-4222-8222-000000000015'::uuid, 'https://picsum.photos/seed/demo-gaming-laptop-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000040'::uuid, 'd2222222-d222-4222-8222-000000000015'::uuid, 'https://picsum.photos/seed/demo-gaming-laptop-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000041'::uuid, 'd2222222-d222-4222-8222-000000000015'::uuid, 'https://picsum.photos/seed/demo-gaming-laptop-3/800/800', 2, false),
    ('d3333333-d333-4333-8333-000000000042'::uuid, 'd2222222-d222-4222-8222-000000000015'::uuid, 'https://picsum.photos/seed/demo-gaming-laptop-4/800/800', 3, false),
    -- 16
    ('d3333333-d333-4333-8333-000000000043'::uuid, 'd2222222-d222-4222-8222-000000000016'::uuid, 'https://picsum.photos/seed/demo-usbc-charger-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000044'::uuid, 'd2222222-d222-4222-8222-000000000016'::uuid, 'https://picsum.photos/seed/demo-usbc-charger-2/800/800', 1, false),
    -- 17
    ('d3333333-d333-4333-8333-000000000045'::uuid, 'd2222222-d222-4222-8222-000000000017'::uuid, 'https://picsum.photos/seed/demo-power-bank-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000046'::uuid, 'd2222222-d222-4222-8222-000000000017'::uuid, 'https://picsum.photos/seed/demo-power-bank-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000047'::uuid, 'd2222222-d222-4222-8222-000000000017'::uuid, 'https://picsum.photos/seed/demo-power-bank-3/800/800', 2, false),
    -- 18
    ('d3333333-d333-4333-8333-000000000048'::uuid, 'd2222222-d222-4222-8222-000000000018'::uuid, 'https://picsum.photos/seed/demo-clear-case-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000049'::uuid, 'd2222222-d222-4222-8222-000000000018'::uuid, 'https://picsum.photos/seed/demo-clear-case-2/800/800', 1, false),
    -- 19
    ('d3333333-d333-4333-8333-000000000050'::uuid, 'd2222222-d222-4222-8222-000000000019'::uuid, 'https://picsum.photos/seed/demo-silicone-case-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000051'::uuid, 'd2222222-d222-4222-8222-000000000019'::uuid, 'https://picsum.photos/seed/demo-silicone-case-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000052'::uuid, 'd2222222-d222-4222-8222-000000000019'::uuid, 'https://picsum.photos/seed/demo-silicone-case-3/800/800', 2, false),
    -- 20
    ('d3333333-d333-4333-8333-000000000053'::uuid, 'd2222222-d222-4222-8222-000000000020'::uuid, 'https://picsum.photos/seed/demo-wireless-mouse-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000054'::uuid, 'd2222222-d222-4222-8222-000000000020'::uuid, 'https://picsum.photos/seed/demo-wireless-mouse-2/800/800', 1, false),
    -- 21
    ('d3333333-d333-4333-8333-000000000055'::uuid, 'd2222222-d222-4222-8222-000000000021'::uuid, 'https://picsum.photos/seed/demo-study-table-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000056'::uuid, 'd2222222-d222-4222-8222-000000000021'::uuid, 'https://picsum.photos/seed/demo-study-table-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000057'::uuid, 'd2222222-d222-4222-8222-000000000021'::uuid, 'https://picsum.photos/seed/demo-study-table-3/800/800', 2, false),
    -- 22
    ('d3333333-d333-4333-8333-000000000058'::uuid, 'd2222222-d222-4222-8222-000000000022'::uuid, 'https://picsum.photos/seed/demo-folding-chair-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000059'::uuid, 'd2222222-d222-4222-8222-000000000022'::uuid, 'https://picsum.photos/seed/demo-folding-chair-2/800/800', 1, false),
    -- 23
    ('d3333333-d333-4333-8333-000000000060'::uuid, 'd2222222-d222-4222-8222-000000000023'::uuid, 'https://picsum.photos/seed/demo-fry-pan-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000061'::uuid, 'd2222222-d222-4222-8222-000000000023'::uuid, 'https://picsum.photos/seed/demo-fry-pan-2/800/800', 1, false),
    -- 24
    ('d3333333-d333-4333-8333-000000000062'::uuid, 'd2222222-d222-4222-8222-000000000024'::uuid, 'https://picsum.photos/seed/demo-pressure-cooker-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000063'::uuid, 'd2222222-d222-4222-8222-000000000024'::uuid, 'https://picsum.photos/seed/demo-pressure-cooker-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000064'::uuid, 'd2222222-d222-4222-8222-000000000024'::uuid, 'https://picsum.photos/seed/demo-pressure-cooker-3/800/800', 2, false),
    -- 25
    ('d3333333-d333-4333-8333-000000000065'::uuid, 'd2222222-d222-4222-8222-000000000025'::uuid, 'https://picsum.photos/seed/demo-spice-jar-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000066'::uuid, 'd2222222-d222-4222-8222-000000000025'::uuid, 'https://picsum.photos/seed/demo-spice-jar-2/800/800', 1, false),
    -- 26
    ('d3333333-d333-4333-8333-000000000067'::uuid, 'd2222222-d222-4222-8222-000000000026'::uuid, 'https://picsum.photos/seed/demo-wall-clock-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000068'::uuid, 'd2222222-d222-4222-8222-000000000026'::uuid, 'https://picsum.photos/seed/demo-wall-clock-2/800/800', 1, false),
    -- 27
    ('d3333333-d333-4333-8333-000000000069'::uuid, 'd2222222-d222-4222-8222-000000000027'::uuid, 'https://picsum.photos/seed/demo-cushion-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000070'::uuid, 'd2222222-d222-4222-8222-000000000027'::uuid, 'https://picsum.photos/seed/demo-cushion-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000071'::uuid, 'd2222222-d222-4222-8222-000000000027'::uuid, 'https://picsum.photos/seed/demo-cushion-3/800/800', 2, false),
    -- 28
    ('d3333333-d333-4333-8333-000000000072'::uuid, 'd2222222-d222-4222-8222-000000000028'::uuid, 'https://picsum.photos/seed/demo-table-lamp-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000073'::uuid, 'd2222222-d222-4222-8222-000000000028'::uuid, 'https://picsum.photos/seed/demo-table-lamp-2/800/800', 1, false),
    -- 29
    ('d3333333-d333-4333-8333-000000000074'::uuid, 'd2222222-d222-4222-8222-000000000029'::uuid, 'https://picsum.photos/seed/demo-shoe-rack-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000075'::uuid, 'd2222222-d222-4222-8222-000000000029'::uuid, 'https://picsum.photos/seed/demo-shoe-rack-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000076'::uuid, 'd2222222-d222-4222-8222-000000000029'::uuid, 'https://picsum.photos/seed/demo-shoe-rack-3/800/800', 2, false),
    -- 30
    ('d3333333-d333-4333-8333-000000000077'::uuid, 'd2222222-d222-4222-8222-000000000030'::uuid, 'https://picsum.photos/seed/demo-water-bottle-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000078'::uuid, 'd2222222-d222-4222-8222-000000000030'::uuid, 'https://picsum.photos/seed/demo-water-bottle-2/800/800', 1, false),
    -- 31
    ('d3333333-d333-4333-8333-000000000079'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid, 'https://picsum.photos/seed/demo-vitamin-c-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000080'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid, 'https://picsum.photos/seed/demo-vitamin-c-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000081'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid, 'https://picsum.photos/seed/demo-vitamin-c-3/800/800', 2, false),
    -- 32
    ('d3333333-d333-4333-8333-000000000082'::uuid, 'd2222222-d222-4222-8222-000000000032'::uuid, 'https://picsum.photos/seed/demo-aloe-wash-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000083'::uuid, 'd2222222-d222-4222-8222-000000000032'::uuid, 'https://picsum.photos/seed/demo-aloe-wash-2/800/800', 1, false),
    -- 33
    ('d3333333-d333-4333-8333-000000000084'::uuid, 'd2222222-d222-4222-8222-000000000033'::uuid, 'https://picsum.photos/seed/demo-sunscreen-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000085'::uuid, 'd2222222-d222-4222-8222-000000000033'::uuid, 'https://picsum.photos/seed/demo-sunscreen-2/800/800', 1, false),
    -- 34
    ('d3333333-d333-4333-8333-000000000086'::uuid, 'd2222222-d222-4222-8222-000000000034'::uuid, 'https://picsum.photos/seed/demo-lipstick-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000087'::uuid, 'd2222222-d222-4222-8222-000000000034'::uuid, 'https://picsum.photos/seed/demo-lipstick-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000088'::uuid, 'd2222222-d222-4222-8222-000000000034'::uuid, 'https://picsum.photos/seed/demo-lipstick-3/800/800', 2, false),
    -- 35
    ('d3333333-d333-4333-8333-000000000089'::uuid, 'd2222222-d222-4222-8222-000000000035'::uuid, 'https://picsum.photos/seed/demo-kajal-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000090'::uuid, 'd2222222-d222-4222-8222-000000000035'::uuid, 'https://picsum.photos/seed/demo-kajal-2/800/800', 1, false),
    -- 36
    ('d3333333-d333-4333-8333-000000000091'::uuid, 'd2222222-d222-4222-8222-000000000036'::uuid, 'https://picsum.photos/seed/demo-compact-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000092'::uuid, 'd2222222-d222-4222-8222-000000000036'::uuid, 'https://picsum.photos/seed/demo-compact-2/800/800', 1, false),
    -- 37
    ('d3333333-d333-4333-8333-000000000093'::uuid, 'd2222222-d222-4222-8222-000000000037'::uuid, 'https://picsum.photos/seed/demo-coconut-oil-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000094'::uuid, 'd2222222-d222-4222-8222-000000000037'::uuid, 'https://picsum.photos/seed/demo-coconut-oil-2/800/800', 1, false),
    -- 38
    ('d3333333-d333-4333-8333-000000000095'::uuid, 'd2222222-d222-4222-8222-000000000038'::uuid, 'https://picsum.photos/seed/demo-shampoo-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000096'::uuid, 'd2222222-d222-4222-8222-000000000038'::uuid, 'https://picsum.photos/seed/demo-shampoo-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000097'::uuid, 'd2222222-d222-4222-8222-000000000038'::uuid, 'https://picsum.photos/seed/demo-shampoo-3/800/800', 2, false),
    -- 39
    ('d3333333-d333-4333-8333-000000000098'::uuid, 'd2222222-d222-4222-8222-000000000039'::uuid, 'https://picsum.photos/seed/demo-hair-serum-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000099'::uuid, 'd2222222-d222-4222-8222-000000000039'::uuid, 'https://picsum.photos/seed/demo-hair-serum-2/800/800', 1, false),
    -- 40
    ('d3333333-d333-4333-8333-000000000100'::uuid, 'd2222222-d222-4222-8222-000000000040'::uuid, 'https://picsum.photos/seed/demo-night-cream-1/800/800', 0, true),
    ('d3333333-d333-4333-8333-000000000101'::uuid, 'd2222222-d222-4222-8222-000000000040'::uuid, 'https://picsum.photos/seed/demo-night-cream-2/800/800', 1, false),
    ('d3333333-d333-4333-8333-000000000102'::uuid, 'd2222222-d222-4222-8222-000000000040'::uuid, 'https://picsum.photos/seed/demo-night-cream-3/800/800', 2, false)
) as seed (id, product_id, storage_path, sort_order, is_primary)
where exists (
  select 1 from public.products as p where p.id = seed.product_id
)
on conflict (id) do nothing;

commit;

-- Summary (runs after commit)
select
  (select count(*) from public.vendor_profiles
    where profile_id in (
      'd1111111-d111-4111-8111-000000000001',
      'd1111111-d111-4111-8111-000000000002',
      'd1111111-d111-4111-8111-000000000003',
      'd1111111-d111-4111-8111-000000000004'
    )) as demo_shops,
  (select count(*) from public.products
    where id between 'd2222222-d222-4222-8222-000000000001'
                 and 'd2222222-d222-4222-8222-000000000040') as demo_products,
  (select count(*) from public.product_images
    where id between 'd3333333-d333-4333-8333-000000000001'
                 and 'd3333333-d333-4333-8333-000000000102') as demo_images;
