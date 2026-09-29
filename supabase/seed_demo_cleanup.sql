-- seed_demo_cleanup.sql
-- Removes ONLY demo rows created by seed_demo.sql.
-- Safe to run many times. No TRUNCATE. Commits.

begin;

-- Cart / wishlist lines that may reference demo products.
delete from public.cart_items
where product_id in (
  select id from public.products
  where vendor_id in (
    'd1111111-d111-4111-8111-000000000001',
    'd1111111-d111-4111-8111-000000000002',
    'd1111111-d111-4111-8111-000000000003',
    'd1111111-d111-4111-8111-000000000004'
  )
  or slug like 'demo-%'
);

delete from public.wishlist_items
where product_id in (
  select id from public.products
  where vendor_id in (
    'd1111111-d111-4111-8111-000000000001',
    'd1111111-d111-4111-8111-000000000002',
    'd1111111-d111-4111-8111-000000000003',
    'd1111111-d111-4111-8111-000000000004'
  )
  or slug like 'demo-%'
);

delete from public.product_reviews
where product_id in (
  select id from public.products
  where vendor_id in (
    'd1111111-d111-4111-8111-000000000001',
    'd1111111-d111-4111-8111-000000000002',
    'd1111111-d111-4111-8111-000000000003',
    'd1111111-d111-4111-8111-000000000004'
  )
  or slug like 'demo-%'
);

delete from public.reel_products
where product_id in (
  select id from public.products
  where vendor_id in (
    'd1111111-d111-4111-8111-000000000001',
    'd1111111-d111-4111-8111-000000000002',
    'd1111111-d111-4111-8111-000000000003',
    'd1111111-d111-4111-8111-000000000004'
  )
  or slug like 'demo-%'
);

delete from public.live_stream_products
where product_id in (
  select id from public.products
  where vendor_id in (
    'd1111111-d111-4111-8111-000000000001',
    'd1111111-d111-4111-8111-000000000002',
    'd1111111-d111-4111-8111-000000000003',
    'd1111111-d111-4111-8111-000000000004'
  )
  or slug like 'demo-%'
);

-- Clear pins that point at demo products.
update public.live_streams
set pinned_product_id = null
where pinned_product_id in (
  select id from public.products
  where vendor_id in (
    'd1111111-d111-4111-8111-000000000001',
    'd1111111-d111-4111-8111-000000000002',
    'd1111111-d111-4111-8111-000000000003',
    'd1111111-d111-4111-8111-000000000004'
  )
  or slug like 'demo-%'
);

-- Images for demo products (cascade would also cover this after product delete).
delete from public.product_images
where product_id in (
  select id from public.products
  where vendor_id in (
    'd1111111-d111-4111-8111-000000000001',
    'd1111111-d111-4111-8111-000000000002',
    'd1111111-d111-4111-8111-000000000003',
    'd1111111-d111-4111-8111-000000000004'
  )
  or slug like 'demo-%'
)
or id between 'd3333333-d333-4333-8333-000000000001'
         and 'd3333333-d333-4333-8333-000000000102';

delete from public.products
where vendor_id in (
  'd1111111-d111-4111-8111-000000000001',
  'd1111111-d111-4111-8111-000000000002',
  'd1111111-d111-4111-8111-000000000003',
  'd1111111-d111-4111-8111-000000000004'
)
or id between 'd2222222-d222-4222-8222-000000000001'
         and 'd2222222-d222-4222-8222-000000000040'
or slug like 'demo-%';

delete from public.vendor_profiles
where profile_id in (
  'd1111111-d111-4111-8111-000000000001',
  'd1111111-d111-4111-8111-000000000002',
  'd1111111-d111-4111-8111-000000000003',
  'd1111111-d111-4111-8111-000000000004'
)
or slug in (
  'demo-style-lane',
  'demo-tech-hub',
  'demo-home-nest',
  'demo-glow-lab'
);

delete from auth.identities
where user_id in (
  'd1111111-d111-4111-8111-000000000001',
  'd1111111-d111-4111-8111-000000000002',
  'd1111111-d111-4111-8111-000000000003',
  'd1111111-d111-4111-8111-000000000004'
)
or user_id in (
  select id from auth.users where email like 'demo-vendor-%@eme.demo'
);

-- Cascades to public.profiles.
delete from auth.users
where id in (
  'd1111111-d111-4111-8111-000000000001',
  'd1111111-d111-4111-8111-000000000002',
  'd1111111-d111-4111-8111-000000000003',
  'd1111111-d111-4111-8111-000000000004'
)
or email like 'demo-vendor-%@eme.demo';

commit;

select
  (select count(*) from auth.users where email like 'demo-vendor-%@eme.demo') as leftover_auth_users,
  (select count(*) from public.profiles
    where id in (
      'd1111111-d111-4111-8111-000000000001',
      'd1111111-d111-4111-8111-000000000002',
      'd1111111-d111-4111-8111-000000000003',
      'd1111111-d111-4111-8111-000000000004'
    )) as leftover_profiles,
  (select count(*) from public.vendor_profiles
    where slug like 'demo-%'
       or profile_id in (
         'd1111111-d111-4111-8111-000000000001',
         'd1111111-d111-4111-8111-000000000002',
         'd1111111-d111-4111-8111-000000000003',
         'd1111111-d111-4111-8111-000000000004'
       )) as leftover_shops,
  (select count(*) from public.products
    where slug like 'demo-%'
       or vendor_id in (
         'd1111111-d111-4111-8111-000000000001',
         'd1111111-d111-4111-8111-000000000002',
         'd1111111-d111-4111-8111-000000000003',
         'd1111111-d111-4111-8111-000000000004'
       )) as leftover_products,
  (select count(*) from public.product_images
    where id between 'd3333333-d333-4333-8333-000000000001'
                 and 'd3333333-d333-4333-8333-000000000102') as leftover_images;
