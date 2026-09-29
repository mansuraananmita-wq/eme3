-- RLS smoke test. Paste this whole file once.
-- It builds throwaway users, checks the policies, prints PASS/FAIL, then ROLLBACK.
-- Nothing remains: users, shops, products, storage rows, and this result table are undone.
-- Requires migrations 0001-0019 and seed.sql (category slug electronics).

begin;

create temp table rls_results (
  test_name text primary key,
  status text not null check (status in ('PASS', 'FAIL')),
  detail text not null
);

do $$
begin
  execute format(
    'grant usage on schema %I to anon, authenticated',
    pg_my_temp_schema()::regnamespace
  );
  execute format(
    'grant select, insert, update, delete on all tables in schema %I to anon, authenticated',
    pg_my_temp_schema()::regnamespace
  );
end;
$$;

create function pg_temp.pass_if_denied(test_name text, sql_state text, message text)
returns void
language plpgsql
as $$
begin
  if sql_state in ('42501', 'P0001')
     or message ilike '%row-level security%'
     or message ilike '%permission denied%'
     or message ilike '%same shop%'
     or message ilike '%only an admin%'
  then
    insert into rls_results values (test_name, 'PASS', message);
  else
    insert into rls_results values (test_name, 'FAIL', sql_state || ' ' || message);
  end if;
end;
$$;

grant execute on function pg_temp.pass_if_denied(text, text, text) to anon, authenticated;

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
        raise notice 'auth.identities insert skipped for %: %', person.email, sqlerrm;
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

insert into rls_results (test_name, status, detail)
select
  'anon reads active product',
  case when count(*) = 1 then 'PASS' else 'FAIL' end,
  'visible=' || count(*)::text
from public.products
where id = '11111111-1111-4111-8111-0000000000a1';

insert into rls_results (test_name, status, detail)
select
  'anon cannot read draft product',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'visible=' || count(*)::text
from public.products
where id = '11111111-1111-4111-8111-0000000000d1';

do $$
declare
  seen integer;
begin
  select count(*) into seen from public.orders;
  insert into rls_results values (
    'anon cannot read orders',
    case when seen = 0 then 'PASS' else 'FAIL' end,
    'visible=' || seen::text
  );
exception
  when insufficient_privilege then
    insert into rls_results values ('anon cannot read orders', 'PASS', sqlerrm);
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

insert into rls_results (test_name, status, detail)
select
  'customer cannot read another cart',
  case when own_rows = 1 and other_rows = 0 then 'PASS' else 'FAIL' end,
  'own=' || own_rows::text || ' other=' || other_rows::text
from (
  select
    count(*) filter (where customer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') as own_rows,
    count(*) filter (where customer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2') as other_rows
  from public.cart_items
) as carts;

do $$
begin
  update public.profiles
  set role = 'admin'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  insert into rls_results values (
    'customer cannot change own role',
    'FAIL',
    'update was allowed'
  );
exception
  when insufficient_privilege or check_violation then
    insert into rls_results values ('customer cannot change own role', 'PASS', sqlerrm);
  when others then
    if sqlerrm ilike '%only an admin%' or sqlerrm ilike '%permission denied%' then
      insert into rls_results values ('customer cannot change own role', 'PASS', sqlerrm);
    else
      insert into rls_results values ('customer cannot change own role', 'FAIL', sqlerrm);
    end if;
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
  insert into rls_results values ('customer cannot insert orders', 'FAIL', 'insert was allowed');
exception
  when others then
    perform pg_temp.pass_if_denied('customer cannot insert orders', sqlstate, sqlerrm);
end;
$$;

do $$
begin
  insert into public.payments (order_id, provider, provider_reference, amount)
  values ('33333333-3333-4333-8333-0000000000a1', 'test', 'rls-ref-customer', 10);
  insert into rls_results values ('customer cannot insert payments', 'FAIL', 'insert was allowed');
exception
  when others then
    perform pg_temp.pass_if_denied('customer cannot insert payments', sqlstate, sqlerrm);
end;
$$;

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('avatars', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/avatar.png');
  insert into rls_results values ('storage avatar own folder', 'PASS', 'inserted');
exception
  when others then
    insert into rls_results values ('storage avatar own folder', 'FAIL', sqlerrm);
end;
$$;

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('avatars', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/nope.png');
  insert into rls_results values ('storage rejects another user folder', 'FAIL', 'insert was allowed');
exception
  when others then
    perform pg_temp.pass_if_denied('storage rejects another user folder', sqlstate, sqlerrm);
end;
$$;

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('product-images', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/front.png');
  insert into rls_results values (
    'storage product image requires approved vendor',
    'FAIL',
    'customer insert was allowed'
  );
exception
  when others then
    perform pg_temp.pass_if_denied(
      'storage product image requires approved vendor',
      sqlstate,
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
  insert into rls_results values (
    'vendor cannot edit another vendor product',
    case
      when changed = 0 and title_now = 'Vendor B product' then 'PASS'
      else 'FAIL'
    end,
    'updated_rows=' || changed::text || ' title=' || coalesce(title_now, 'null')
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
  insert into rls_results values (
    'vendor cannot tag another vendor product',
    'FAIL',
    'insert was allowed'
  );
exception
  when others then
    perform pg_temp.pass_if_denied('vendor cannot tag another vendor product', sqlstate, sqlerrm);
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
  insert into rls_results values ('vendor cannot insert orders', 'FAIL', 'insert was allowed');
exception
  when others then
    perform pg_temp.pass_if_denied('vendor cannot insert orders', sqlstate, sqlerrm);
end;
$$;

do $$
begin
  insert into public.payments (order_id, provider, provider_reference, amount)
  values ('33333333-3333-4333-8333-0000000000a1', 'test', 'rls-ref-vendor', 10);
  insert into rls_results values ('vendor cannot insert payments', 'FAIL', 'insert was allowed');
exception
  when others then
    perform pg_temp.pass_if_denied('vendor cannot insert payments', sqlstate, sqlerrm);
end;
$$;

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('product-images', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/front.png');
  insert into rls_results values ('storage vendor own product image', 'PASS', 'inserted');
exception
  when others then
    insert into rls_results values ('storage vendor own product image', 'FAIL', sqlerrm);
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

insert into rls_results (test_name, status, detail)
select
  'admin reads orders',
  case when count(*) >= 1 then 'PASS' else 'FAIL' end,
  'visible=' || count(*)::text
from public.orders;

insert into rls_results (test_name, status, detail)
select
  'admin reads draft product',
  case when count(*) = 1 then 'PASS' else 'FAIL' end,
  'visible=' || count(*)::text
from public.products
where id = '11111111-1111-4111-8111-0000000000d1';

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
  insert into rls_results values ('admin cannot insert orders', 'FAIL', 'insert was allowed');
exception
  when others then
    perform pg_temp.pass_if_denied('admin cannot insert orders', sqlstate, sqlerrm);
end;
$$;

do $$
begin
  insert into public.payments (order_id, provider, provider_reference, amount)
  values ('33333333-3333-4333-8333-0000000000a1', 'test', 'rls-ref-admin', 10);
  insert into rls_results values ('admin cannot insert payments', 'FAIL', 'insert was allowed');
exception
  when others then
    perform pg_temp.pass_if_denied('admin cannot insert payments', sqlstate, sqlerrm);
end;
$$;

reset role;

select test_name, status, detail
from rls_results
order by status desc, test_name;

rollback;
