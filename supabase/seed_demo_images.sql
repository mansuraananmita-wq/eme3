-- seed_demo_images.sql
-- Safe re-run: deletes demo product_images then inserts matching SVG URLs.
-- Requires files uploaded to Storage bucket product-images under demo/
-- (see supabase/scripts/upload-demo-images.md).
-- Does not create duplicate primary images.

begin;

delete from public.product_images
where product_id between 'd2222222-d222-4222-8222-000000000001' and 'd2222222-d222-4222-8222-000000000150'
   or id between 'd3333333-d333-4333-8333-000000000001' and 'd3333333-d333-4333-8333-000000000525';

insert into public.product_images (id, product_id, storage_path, sort_order, is_primary)
values
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
on conflict (id) do update set
  product_id = excluded.product_id,
  storage_path = excluded.storage_path,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary;

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/purush-lane-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/purush-lane-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000001';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/nari-atelier-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/nari-atelier-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000002';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/gadget-bazar-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/gadget-bazar-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000003';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/case-corner-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/case-corner-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000004';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/ghor-o-ranna-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/ghor-o-ranna-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000005';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/rupchaya-beauty-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/rupchaya-beauty-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000006';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/bazaar-basket-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/bazaar-basket-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000007';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/boighar-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/boighar-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000008';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/khelaghar-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/khelaghar-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000009';

update public.vendor_profiles set
  logo_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/choto-bondhu-logo.svg',
  banner_url = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/shops/choto-bondhu-banner.svg'
where profile_id = 'd1111111-d111-4111-8111-000000000010';

update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/purush-lane-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000001';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/purush-lane-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000002';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/purush-lane-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000003';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/nari-atelier-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000004';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/nari-atelier-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000005';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/nari-atelier-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000006';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/gadget-bazar-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000007';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/gadget-bazar-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000008';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/gadget-bazar-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000009';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/case-corner-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000010';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/case-corner-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000011';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/case-corner-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000012';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/ghor-o-ranna-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000013';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/ghor-o-ranna-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000014';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/ghor-o-ranna-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000015';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/rupchaya-beauty-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000016';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/rupchaya-beauty-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000017';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/rupchaya-beauty-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000018';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/bazaar-basket-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000019';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/bazaar-basket-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000020';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/bazaar-basket-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000021';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/boighar-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000022';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/boighar-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000023';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/boighar-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000024';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/khelaghar-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000025';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/khelaghar-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000026';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/khelaghar-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000027';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/choto-bondhu-reel-1.svg'
where id = 'd5555555-d555-4555-8555-000000000028';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/choto-bondhu-reel-2.svg'
where id = 'd5555555-d555-4555-8555-000000000029';
update public.reels set thumbnail_path = 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/product-images/demo/reels/choto-bondhu-reel-3.svg'
where id = 'd5555555-d555-4555-8555-000000000030';

commit;
