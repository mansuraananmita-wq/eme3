-- 9999_checks.sql
-- Read-only. Run after 0012, and after seed.sql if you want the category count.
-- A healthy database returns no row whose status is FAIL.

with expected (table_name) as (
  values
    ('profiles'),
    ('vendor_profiles'),
    ('categories'),
    ('products'),
    ('product_images'),
    ('product_reviews'),
    ('addresses'),
    ('cart_items'),
    ('wishlist_items'),
    ('vendor_follows'),
    ('orders'),
    ('order_items'),
    ('payments'),
    ('reels'),
    ('reel_products'),
    ('reel_likes'),
    ('reel_saves'),
    ('reel_comments'),
    ('live_streams'),
    ('live_stream_products'),
    ('live_messages'),
    ('conversations'),
    ('messages'),
    ('user_events'),
    ('disputes'),
    ('payouts'),
    ('platform_settings')
),
public_tables as (
  select pg_class.relname as table_name, pg_class.relrowsecurity as rls_enabled
  from pg_class
  join pg_namespace on pg_namespace.oid = pg_class.relnamespace
  where pg_namespace.nspname = 'public'
    and pg_class.relkind = 'r'
),
checks as (
  select
    'missing table'::text as check_name,
    case when count(*) = 0 then 'OK' else 'FAIL' end as status,
    coalesce(string_agg(expected.table_name, ', ' order by expected.table_name), 'none') as detail
  from expected
  left join public_tables on public_tables.table_name = expected.table_name
  where public_tables.table_name is null

  union all

  select
    'unexpected public table',
    case when count(*) = 0 then 'OK' else 'FAIL' end,
    coalesce(string_agg(public_tables.table_name, ', ' order by public_tables.table_name), 'none')
  from public_tables
  left join expected on expected.table_name = public_tables.table_name
  where expected.table_name is null

  union all

  select
    'rls disabled',
    case when count(*) = 0 then 'OK' else 'FAIL' end,
    coalesce(string_agg(table_name, ', ' order by table_name), 'none')
  from public_tables
  where not rls_enabled

  union all

  select
    'policies exist',
    case when count(*) = 0 then 'OK' else 'FAIL' end,
    count(*)::text || ' policies'
  from pg_policies
  where schemaname = 'public'

  union all

  select
    'extensions',
    case
      when count(*) filter (where extname in ('pgcrypto', 'pg_trgm', 'vector')) = 3 then 'OK'
      else 'FAIL'
    end,
    coalesce(string_agg(extname, ', ' order by extname), 'none')
  from pg_extension
  where extname in ('pgcrypto', 'pg_trgm', 'vector')

  union all

  select
    'embedding columns',
    case when count(*) = 3 then 'OK' else 'FAIL' end,
    coalesce(string_agg(table_name || '.' || column_name, ', ' order by table_name), 'none')
  from information_schema.columns
  where table_schema = 'public'
    and column_name = 'embedding'
    and table_name in ('products', 'reels', 'live_streams')

  union all

  select
    'product search vector',
    case when count(*) = 1 then 'OK' else 'FAIL' end,
    coalesce(string_agg(column_name, ', '), 'missing')
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'products'
    and column_name = 'search_vector'

  union all

  select
    'vector ann indexes',
    case when count(*) = 0 then 'OK' else 'FAIL' end,
    coalesce(string_agg(indexname, ', ' order by indexname), 'none')
  from pg_indexes
  where schemaname = 'public'
    and (indexdef ilike '%using hnsw%' or indexdef ilike '%using ivfflat%')

  union all

  select
    'updated_at triggers',
    case when count(*) = 27 then 'OK' else 'FAIL' end,
    count(*)::text || ' of 27'
  from pg_trigger
  join pg_class on pg_class.oid = pg_trigger.tgrelid
  join pg_namespace on pg_namespace.oid = pg_class.relnamespace
  where pg_namespace.nspname = 'public'
    and not pg_trigger.tgisinternal
    and pg_trigger.tgname = 'set_updated_at'

  union all

  select
    'counter triggers',
    case when count(*) = 5 then 'OK' else 'FAIL' end,
    coalesce(string_agg(tgname, ', ' order by tgname), 'none')
  from pg_trigger
  where not tgisinternal
    and tgname in (
      'sync_product_review_stats',
      'sync_vendor_followers_count',
      'sync_reel_likes_count',
      'sync_reel_saves_count',
      'sync_reel_comments_count'
    )

  union all

  select
    'categories seeded',
    case when count(*) >= 28 then 'OK' else 'FAIL' end,
    count(*)::text || ' rows (expect 28 after seed.sql)'
  from public.categories
)
select check_name, status, detail
from checks
order by status desc, check_name;
