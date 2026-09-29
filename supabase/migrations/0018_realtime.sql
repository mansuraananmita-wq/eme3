-- 0018_realtime.sql
-- Run after 0017.
--
-- Which feature reads which table:
--   live chat              -> live_messages
--   pinned product         -> live_streams.pinned_product_id
--   live inventory         -> products.stock
--   vendor live order count -> order_items and orders
--   direct messages        -> messages
--   reel comments          -> reel_comments
--   live catalog chips     -> live_stream_products
--
-- Live reactions and viewer counts do not use a table.
-- They use Realtime Broadcast and Presence on the private channel "live:{stream_id}".
-- The client must open that channel with private: true, or these policies are not applied.
-- Only a signed-in user can join. Only the stream owner can broadcast an event named "pin".

alter table public.products replica identity full;
alter table public.live_streams replica identity full;
alter table public.order_items replica identity full;

comment on column public.products.stock is
  'Realtime live inventory watches products.stock. Replica identity is FULL so the previous stock is in the payload.';

comment on column public.live_streams.pinned_product_id is
  'Realtime pinned product. Subscribe to live_streams and read pinned_product_id. Replica identity is FULL. Must be a product already attached to this stream, or null.';

comment on column public.order_items.item_status is
  'Realtime vendor live order count watches order_items together with orders. Replica identity on order_items is FULL.';

comment on column public.orders.status is
  'Realtime vendor live order count also watches orders.status, paired with order_items.';

comment on table public.live_messages is
  'Live room chat lines. Realtime chat subscribes to this table. Reactions and viewer counts use Broadcast and Presence on channel live:{stream_id}, not this table.';

comment on table public.reel_comments is
  'Top-level comments and replies. parent_id must point at a comment on the same reel. comments_count includes replies. Realtime delivers new comments from this table.';

do $$
declare
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Publication supabase_realtime does not exist';
  end if;

  foreach table_name in array array[
    'live_messages',
    'live_streams',
    'live_stream_products',
    'products',
    'order_items',
    'orders',
    'messages',
    'reel_comments'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Private Broadcast / Presence authorization.
-- If realtime.messages is missing, enable Realtime Authorization in the dashboard
-- and re-run this file. Postgres Changes do not use this table; they use each
-- table's own RLS policies.

create or replace function public.owns_live_topic(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  raw text := topic;
  stream_id uuid;
begin
  if raw is null then
    return false;
  end if;

  if raw like 'realtime:%' then
    raw := substr(raw, 10);
  end if;

  if raw like 'live:%' then
    raw := substr(raw, 6);
  else
    return false;
  end if;

  stream_id := raw::uuid;
  return exists (
    select 1
    from public.live_streams
    where id = stream_id
      and vendor_id = auth.uid()
  );
exception
  when invalid_text_representation then
    return false;
end;
$$;

comment on function public.owns_live_topic(text) is
  'True when the Realtime topic live:{stream_id} belongs to the signed-in shop. Accepts an optional realtime: prefix.';

revoke all on function public.owns_live_topic(text) from public;
grant execute on function public.owns_live_topic(text) to authenticated;

do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages was not found. In the Supabase dashboard, open Realtime settings and turn Authorization on, then run this file again. Until then, private channel policies for live:{stream_id} are not installed.';
    return;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'eme_live_channel_read'
  ) then
    execute $policy$
      create policy eme_live_channel_read on realtime.messages
      for select to authenticated
      using (
        realtime.topic() ~ '^(realtime:)?live:[0-9a-fA-F-]{36}$'
        and extension in ('broadcast', 'presence')
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'eme_live_channel_write'
  ) then
    execute $policy$
      create policy eme_live_channel_write on realtime.messages
      for insert to authenticated
      with check (
        realtime.topic() ~ '^(realtime:)?live:[0-9a-fA-F-]{36}$'
        and extension in ('broadcast', 'presence')
        and (
          extension is distinct from 'broadcast'
          or event is distinct from 'pin'
          or public.owns_live_topic(realtime.topic())
        )
      )
    $policy$;
  end if;

  execute 'alter table realtime.messages enable row level security';
exception
  when undefined_function or undefined_column or insufficient_privilege then
    raise notice 'Could not install realtime.messages policies (%). Add them in the dashboard: signed-in users may select and insert broadcast/presence on topic live:{stream_id}; event "pin" is allowed only for the stream owner.', sqlerrm;
end;
$$;
