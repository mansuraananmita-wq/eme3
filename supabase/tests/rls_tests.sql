-- RLS smoke test. Paste this whole file once.
-- The helper creates public._rls_results itself on the first call.
-- A separate create-table statement is not visible to that call in the SQL editor,
-- which is why the insert raised 42P01.
-- The opening drops remove leftovers from the previous run.
-- Requires migrations 0001-0019 and seed.sql (category slug electronics).

drop table if exists public._rls_results;
drop function if exists public._rls_record(text, boolean, text);

create or replace function public._rls_record(test_name text, ok boolean, detail text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if to_regclass('public._rls_results') is null then
    create table public._rls_results (
      id bigint generated always as identity,
      test_name text,
      status text,
      detail text
    );
  end if;

  execute
    'insert into public._rls_results (test_name, status, detail) values ($1, $2, $3)'
    using
      test_name,
      case when ok then 'PASS' else 'FAIL' end,
      coalesce(detail, '');
end;
$fn$;

grant execute on function public._rls_record(text, boolean, text) to anon, authenticated;

select public._rls_record('tests ran', true, 'pending');

do $$
declare
  person record;
begin
  if not exists (select 1 from public.categories where slug = 'electronics') then
    raise exception 'Category electronics is missing. Run supabase/seed.sql first.';
  end if;

  for person in
    select *
    from (
      values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'rls-customer-a@eme.test', 'RLS Customer A'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid, 'rls-customer-b@eme.test', 'RLS Customer B'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid, 'rls-vendor-a@eme.test', 'RLS Vendor A'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid, 'rls-vendor-b@eme.test', 'RLS Vendor B'),
        ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1'::uuid, 'rls-admin@eme.test', 'RLS Admin')
    ) as seed (id, email, full_name)
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
      extensions.crypt('Rls-test-password', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', person.full_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

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
      );
    exception
      when others then
        null;
    end;
  end loop;
end;
$$;

update public.profiles
set role = 'vendor'
where id in (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
);

update public.profiles
set role = 'admin'
where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';

insert into public.vendor_profiles (profile_id, shop_name, slug, status)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'RLS Shop A', 'rls-shop-a', 'approved'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'RLS Shop B', 'rls-shop-b', 'approved');

insert into public.products (
  id, vendor_id, category_id, title, slug, price, status
)
select
  seed.id,
  seed.vendor_id,
  category.id,
  seed.title,
  seed.slug,
  100,
  seed.status::public.product_status
from (
  values
    (
      '11111111-1111-4111-8111-0000000000a1'::uuid,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
      'Vendor A product',
      'rls-vendor-a-product',
      'active'
    ),
    (
      '11111111-1111-4111-8111-0000000000b1'::uuid,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
      'Vendor B product',
      'rls-vendor-b-product',
      'active'
    ),
    (
      '11111111-1111-4111-8111-0000000000d1'::uuid,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
      'Vendor A draft',
      'rls-vendor-a-draft',
      'draft'
    )
) as seed (id, vendor_id, title, slug, status)
cross join lateral (
  select id from public.categories where slug = 'electronics' limit 1
) as category;

insert into public.reels (id, vendor_id, caption, video_path, status)
values (
  '22222222-2222-4222-8222-0000000000a1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'RLS reel',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/clip.mp4',
  'published'
);

insert into public.cart_items (customer_id, product_id, quantity)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-0000000000a1', 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-0000000000a1', 1);

insert into public.orders (
  id, customer_id, subtotal, shipping_fee, total, shipping_address
) values (
  '33333333-3333-4333-8333-0000000000a1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  100,
  0,
  100,
  '{"recipient_name":"A","phone":"01711111111","line1":"House 1","city":"Dhaka","district":"Dhaka"}'::jsonb
);

-- Anonymous.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role anon;

do $$
declare
  seen integer;
begin
  select count(*) into seen
  from public.products
  where id = '11111111-1111-4111-8111-0000000000a1';
  perform public._rls_record('anon reads active product', seen = 1, 'visible=' || seen::text);
exception
  when others then
    perform public._rls_record('anon reads active product', false, sqlerrm);
end;
$$;

do $$
declare
  seen integer;
begin
  select count(*) into seen
  from public.products
  where id = '11111111-1111-4111-8111-0000000000d1';
  perform public._rls_record('anon cannot read draft product', seen = 0, 'visible=' || seen::text);
exception
  when others then
    perform public._rls_record('anon cannot read draft product', false, sqlerrm);
end;
$$;

do $$
declare
  seen integer;
begin
  select count(*) into seen from public.orders;
  perform public._rls_record('anon cannot read orders', seen = 0, 'visible=' || seen::text);
exception
  when others then
    perform public._rls_record(
      'anon cannot read orders',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

-- Customer A.
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  own_rows integer;
  other_rows integer;
begin
  select
    count(*) filter (where customer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
    count(*) filter (where customer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')
  into own_rows, other_rows
  from public.cart_items;
  perform public._rls_record(
    'customer cannot read another cart',
    own_rows = 1 and other_rows = 0,
    'own=' || own_rows::text || ' other=' || other_rows::text
  );
exception
  when others then
    perform public._rls_record('customer cannot read another cart', false, sqlerrm);
end;
$$;

do $$
begin
  update public.profiles
  set role = 'admin'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  perform public._rls_record('customer cannot change own role', false, 'update was allowed');
exception
  when others then
    perform public._rls_record(
      'customer cannot change own role',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%'
        or sqlerrm ilike '%only an admin%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into public.orders (
    customer_id, subtotal, shipping_fee, total, shipping_address
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    10,
    0,
    10,
    '{"recipient_name":"A","phone":"01711111111","line1":"House 1","city":"Dhaka","district":"Dhaka"}'::jsonb
  );
  perform public._rls_record('customer cannot insert orders', false, 'insert was allowed');
exception
  when others then
    perform public._rls_record(
      'customer cannot insert orders',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into public.payments (order_id, provider, provider_reference, amount)
  values ('33333333-3333-4333-8333-0000000000a1', 'test', 'rls-ref-customer', 10);
  perform public._rls_record('customer cannot insert payments', false, 'insert was allowed');
exception
  when others then
    perform public._rls_record(
      'customer cannot insert payments',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('avatars', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/avatar.png');
  perform public._rls_record('storage avatar own folder', true, 'inserted');
exception
  when others then
    perform public._rls_record('storage avatar own folder', false, sqlerrm);
end;
$$;

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('avatars', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/nope.png');
  perform public._rls_record('storage rejects another user folder', false, 'insert was allowed');
exception
  when others then
    perform public._rls_record(
      'storage rejects another user folder',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('product-images', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/front.png');
  perform public._rls_record(
    'storage product image requires approved vendor',
    false,
    'customer insert was allowed'
  );
exception
  when others then
    perform public._rls_record(
      'storage product image requires approved vendor',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

-- Vendor A.
reset role;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  changed integer;
  title_now text;
begin
  update public.products
  set title = 'hacked-by-vendor-a'
  where id = '11111111-1111-4111-8111-0000000000b1';
  get diagnostics changed = row_count;
  select title into title_now
  from public.products
  where id = '11111111-1111-4111-8111-0000000000b1';
  perform public._rls_record(
    'vendor cannot edit another vendor product',
    changed = 0 and title_now = 'Vendor B product',
    'updated_rows=' || changed::text || ' title=' || coalesce(title_now, 'null')
  );
exception
  when others then
    perform public._rls_record(
      'vendor cannot edit another vendor product',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into public.reel_products (reel_id, product_id)
  values (
    '22222222-2222-4222-8222-0000000000a1',
    '11111111-1111-4111-8111-0000000000b1'
  );
  perform public._rls_record('vendor cannot tag another vendor product', false, 'insert was allowed');
exception
  when others then
    perform public._rls_record(
      'vendor cannot tag another vendor product',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%'
        or sqlerrm ilike '%same shop%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into public.orders (
    customer_id, subtotal, shipping_fee, total, shipping_address
  ) values (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    10,
    0,
    10,
    '{"recipient_name":"A","phone":"01711111111","line1":"House 1","city":"Dhaka","district":"Dhaka"}'::jsonb
  );
  perform public._rls_record('vendor cannot insert orders', false, 'insert was allowed');
exception
  when others then
    perform public._rls_record(
      'vendor cannot insert orders',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into public.payments (order_id, provider, provider_reference, amount)
  values ('33333333-3333-4333-8333-0000000000a1', 'test', 'rls-ref-vendor', 10);
  perform public._rls_record('vendor cannot insert payments', false, 'insert was allowed');
exception
  when others then
    perform public._rls_record(
      'vendor cannot insert payments',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('product-images', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/front.png');
  perform public._rls_record('storage vendor own product image', true, 'inserted');
exception
  when others then
    perform public._rls_record('storage vendor own product image', false, sqlerrm);
end;
$$;

-- Admin.
reset role;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-4ccc-8ccc-ccccccccccc1","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  seen integer;
begin
  select count(*) into seen from public.orders;
  perform public._rls_record('admin reads orders', seen >= 1, 'visible=' || seen::text);
exception
  when others then
    perform public._rls_record('admin reads orders', false, sqlerrm);
end;
$$;

do $$
declare
  seen integer;
begin
  select count(*) into seen
  from public.products
  where id = '11111111-1111-4111-8111-0000000000d1';
  perform public._rls_record('admin reads draft product', seen = 1, 'visible=' || seen::text);
exception
  when others then
    perform public._rls_record('admin reads draft product', false, sqlerrm);
end;
$$;

do $$
begin
  insert into public.orders (
    customer_id, subtotal, shipping_fee, total, shipping_address
  ) values (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    10,
    0,
    10,
    '{"recipient_name":"A","phone":"01711111111","line1":"House 1","city":"Dhaka","district":"Dhaka"}'::jsonb
  );
  perform public._rls_record('admin cannot insert orders', false, 'insert was allowed');
exception
  when others then
    perform public._rls_record(
      'admin cannot insert orders',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

do $$
begin
  insert into public.payments (order_id, provider, provider_reference, amount)
  values ('33333333-3333-4333-8333-0000000000a1', 'test', 'rls-ref-admin', 10);
  perform public._rls_record('admin cannot insert payments', false, 'insert was allowed');
exception
  when others then
    perform public._rls_record(
      'admin cannot insert payments',
      sqlstate in ('42501', 'P0001')
        or sqlerrm ilike '%row-level security%'
        or sqlerrm ilike '%permission denied%',
      sqlerrm
    );
end;
$$;

reset role;

select public._rls_record(
  'cleanup check',
  true,
  'Rows below are removed when this script is run again. ROLLBACK cannot drop a table the SQL editor already committed.'
);

update public._rls_results
set detail = (
  select count(*)::text
  from public._rls_results
  where test_name not in ('tests ran', 'cleanup check')
)
where test_name = 'tests ran';

select test_name, status, detail
from public._rls_results
order by id;
