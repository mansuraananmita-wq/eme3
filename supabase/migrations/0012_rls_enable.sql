-- 0012_rls_enable.sql
-- Last schema migration. Enables RLS on every public table.
-- There are no policies in this file. With RLS on and no policy, the API sees nothing.
-- The table owner (SQL editor) still bypasses RLS, so you can seed and promote the first admin.
-- Do not FORCE ROW LEVEL SECURITY. That would block the SQL editor too.

alter table public.profiles enable row level security;
alter table public.vendor_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_reviews enable row level security;
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.vendor_follows enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.reels enable row level security;
alter table public.reel_products enable row level security;
alter table public.reel_likes enable row level security;
alter table public.reel_saves enable row level security;
alter table public.reel_comments enable row level security;
alter table public.live_streams enable row level security;
alter table public.live_stream_products enable row level security;
alter table public.live_messages enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_events enable row level security;
alter table public.disputes enable row level security;
alter table public.payouts enable row level security;
alter table public.platform_settings enable row level security;

-- Safety net: any other ordinary table in public is locked the same way.
do $$
declare
  table_name text;
begin
  for table_name in
    select pg_class.relname
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind = 'r'
      and not pg_class.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

-- Grants let the API reach a table. RLS is the gate, and there is no policy yet.
-- service_role is intentionally not granted here.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
