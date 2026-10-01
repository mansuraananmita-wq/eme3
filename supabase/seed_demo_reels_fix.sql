-- seed_demo_reels_fix.sql
-- Safe re-run: repairs demo reel video URLs (Google sample MP4s now return 403),
-- points thumbnail_path at the first linked product SVG, ensures every demo reel
-- has ≥1 reel_products row, and refreshes captions. No duplicate links.
--
-- Run in Supabase SQL Editor (demo reels already seeded).

begin;

-- 1) Working public sample MP4s (gtv-videos-bucket URLs currently 403).
update public.reels set
  video_path = case (right(id::text, 2)::int - 1) % 9
    when 0 then 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
    when 1 then 'https://www.w3schools.com/html/mov_bbb.mp4'
    when 2 then 'https://www.w3schools.com/html/movie.mp4'
    when 3 then 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4'
    when 4 then 'https://download.samplelib.com/mp4/sample-5s.mp4'
    when 5 then 'https://download.samplelib.com/mp4/sample-10s.mp4'
    when 6 then 'https://download.samplelib.com/mp4/sample-15s.mp4'
    when 7 then 'https://download.samplelib.com/mp4/sample-20s.mp4'
    else 'https://download.samplelib.com/mp4/sample-30s.mp4'
  end
where id between 'd5555555-d555-4555-8555-000000000001'
            and 'd5555555-d555-4555-8555-000000000030';

-- 2) Ensure every reel has at least one product (skip if any link exists).
insert into public.reel_products (id, reel_id, product_id, sort_order)
select seed.id, seed.reel_id, seed.product_id, 0
from (values
  ('d6666666-d666-4666-8666-000000000101'::uuid, 'd5555555-d555-4555-8555-000000000001'::uuid, 'd2222222-d222-4222-8222-000000000001'::uuid),
  ('d6666666-d666-4666-8666-000000000102'::uuid, 'd5555555-d555-4555-8555-000000000002'::uuid, 'd2222222-d222-4222-8222-000000000002'::uuid),
  ('d6666666-d666-4666-8666-000000000103'::uuid, 'd5555555-d555-4555-8555-000000000003'::uuid, 'd2222222-d222-4222-8222-000000000003'::uuid),
  ('d6666666-d666-4666-8666-000000000104'::uuid, 'd5555555-d555-4555-8555-000000000004'::uuid, 'd2222222-d222-4222-8222-000000000016'::uuid),
  ('d6666666-d666-4666-8666-000000000105'::uuid, 'd5555555-d555-4555-8555-000000000005'::uuid, 'd2222222-d222-4222-8222-000000000017'::uuid),
  ('d6666666-d666-4666-8666-000000000106'::uuid, 'd5555555-d555-4555-8555-000000000006'::uuid, 'd2222222-d222-4222-8222-000000000018'::uuid),
  ('d6666666-d666-4666-8666-000000000107'::uuid, 'd5555555-d555-4555-8555-000000000007'::uuid, 'd2222222-d222-4222-8222-000000000031'::uuid),
  ('d6666666-d666-4666-8666-000000000108'::uuid, 'd5555555-d555-4555-8555-000000000008'::uuid, 'd2222222-d222-4222-8222-000000000032'::uuid),
  ('d6666666-d666-4666-8666-000000000109'::uuid, 'd5555555-d555-4555-8555-000000000009'::uuid, 'd2222222-d222-4222-8222-000000000033'::uuid),
  ('d6666666-d666-4666-8666-000000000110'::uuid, 'd5555555-d555-4555-8555-000000000010'::uuid, 'd2222222-d222-4222-8222-000000000046'::uuid),
  ('d6666666-d666-4666-8666-000000000111'::uuid, 'd5555555-d555-4555-8555-000000000011'::uuid, 'd2222222-d222-4222-8222-000000000047'::uuid),
  ('d6666666-d666-4666-8666-000000000112'::uuid, 'd5555555-d555-4555-8555-000000000012'::uuid, 'd2222222-d222-4222-8222-000000000048'::uuid),
  ('d6666666-d666-4666-8666-000000000113'::uuid, 'd5555555-d555-4555-8555-000000000013'::uuid, 'd2222222-d222-4222-8222-000000000061'::uuid),
  ('d6666666-d666-4666-8666-000000000114'::uuid, 'd5555555-d555-4555-8555-000000000014'::uuid, 'd2222222-d222-4222-8222-000000000062'::uuid),
  ('d6666666-d666-4666-8666-000000000115'::uuid, 'd5555555-d555-4555-8555-000000000015'::uuid, 'd2222222-d222-4222-8222-000000000063'::uuid),
  ('d6666666-d666-4666-8666-000000000116'::uuid, 'd5555555-d555-4555-8555-000000000016'::uuid, 'd2222222-d222-4222-8222-000000000076'::uuid),
  ('d6666666-d666-4666-8666-000000000117'::uuid, 'd5555555-d555-4555-8555-000000000017'::uuid, 'd2222222-d222-4222-8222-000000000077'::uuid),
  ('d6666666-d666-4666-8666-000000000118'::uuid, 'd5555555-d555-4555-8555-000000000018'::uuid, 'd2222222-d222-4222-8222-000000000078'::uuid),
  ('d6666666-d666-4666-8666-000000000119'::uuid, 'd5555555-d555-4555-8555-000000000019'::uuid, 'd2222222-d222-4222-8222-000000000091'::uuid),
  ('d6666666-d666-4666-8666-000000000120'::uuid, 'd5555555-d555-4555-8555-000000000020'::uuid, 'd2222222-d222-4222-8222-000000000092'::uuid),
  ('d6666666-d666-4666-8666-000000000121'::uuid, 'd5555555-d555-4555-8555-000000000021'::uuid, 'd2222222-d222-4222-8222-000000000093'::uuid),
  ('d6666666-d666-4666-8666-000000000122'::uuid, 'd5555555-d555-4555-8555-000000000022'::uuid, 'd2222222-d222-4222-8222-000000000106'::uuid),
  ('d6666666-d666-4666-8666-000000000123'::uuid, 'd5555555-d555-4555-8555-000000000023'::uuid, 'd2222222-d222-4222-8222-000000000107'::uuid),
  ('d6666666-d666-4666-8666-000000000124'::uuid, 'd5555555-d555-4555-8555-000000000024'::uuid, 'd2222222-d222-4222-8222-000000000108'::uuid),
  ('d6666666-d666-4666-8666-000000000125'::uuid, 'd5555555-d555-4555-8555-000000000025'::uuid, 'd2222222-d222-4222-8222-000000000121'::uuid),
  ('d6666666-d666-4666-8666-000000000126'::uuid, 'd5555555-d555-4555-8555-000000000026'::uuid, 'd2222222-d222-4222-8222-000000000122'::uuid),
  ('d6666666-d666-4666-8666-000000000127'::uuid, 'd5555555-d555-4555-8555-000000000027'::uuid, 'd2222222-d222-4222-8222-000000000123'::uuid),
  ('d6666666-d666-4666-8666-000000000128'::uuid, 'd5555555-d555-4555-8555-000000000028'::uuid, 'd2222222-d222-4222-8222-000000000136'::uuid),
  ('d6666666-d666-4666-8666-000000000129'::uuid, 'd5555555-d555-4555-8555-000000000029'::uuid, 'd2222222-d222-4222-8222-000000000137'::uuid),
  ('d6666666-d666-4666-8666-000000000130'::uuid, 'd5555555-d555-4555-8555-000000000030'::uuid, 'd2222222-d222-4222-8222-000000000138'::uuid)
) as seed (id, reel_id, product_id)
where exists (select 1 from public.reels as r where r.id = seed.reel_id)
  and exists (select 1 from public.products as p where p.id = seed.product_id)
  and not exists (select 1 from public.reel_products as rp where rp.reel_id = seed.reel_id)
on conflict (id) do nothing;

-- 3) Thumbnail = first linked product SVG illustration.
update public.reels as r
set thumbnail_path = coalesce(
  (
    select case right(rp.product_id::text, 3)
      when '001' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/panjabi.svg'
      when '002' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/jeans.svg'
      when '003' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/shirt.svg'
      when '016' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/salwar.svg'
      when '017' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/kurti.svg'
      when '018' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/heels.svg'
      when '031' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/phone.svg'
      when '032' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/phone.svg'
      when '033' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/featurephone.svg'
      when '046' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/charger.svg'
      when '047' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/powerbank.svg'
      when '048' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/phonecase.svg'
      when '061' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/table.svg'
      when '062' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/chair.svg'
      when '063' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/frypan.svg'
      when '076' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/serum.svg'
      when '077' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/facewash.svg'
      when '078' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/sunscreen.svg'
      when '091' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/tea.svg'
      when '092' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/oil.svg'
      when '093' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/rice.svg'
      when '106' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/novel.svg'
      when '107' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/storybook.svg'
      when '108' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/notebook.svg'
      when '121' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/yogamat.svg'
      when '122' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/dumbbell.svg'
      when '123' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/football.svg'
      when '136' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/teddy.svg'
      when '137' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/blocks.svg'
      when '138' then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/products/remotecar.svg'
      else r.thumbnail_path
    end
    from public.reel_products as rp
    where rp.reel_id = r.id
    order by rp.sort_order asc
    limit 1
  ),
  r.thumbnail_path
)
where r.id between 'd5555555-d555-4555-8555-000000000001'
             and 'd5555555-d555-4555-8555-000000000030';

-- 4) Caption names the primary product + shop.
update public.reels as r
set caption = coalesce(
  (
    select p.title || ' — ' || vp.shop_name
    from public.reel_products as rp
    join public.products as p on p.id = rp.product_id
    join public.vendor_profiles as vp on vp.profile_id = r.vendor_id
    where rp.reel_id = r.id
    order by rp.sort_order asc
    limit 1
  ),
  r.caption
)
where r.id between 'd5555555-d555-4555-8555-000000000001'
             and 'd5555555-d555-4555-8555-000000000030';

commit;
