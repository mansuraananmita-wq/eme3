-- 0013_grants_hardening.sql
-- Run after 0012. Revokes the wide table grants, then grants back the columns
-- the API is allowed to touch. Row policies come in 0014-0016.
--
-- Default privileges below apply only to the role running this file (postgres
-- in the SQL editor). postgres cannot change default privileges owned by
-- supabase_admin. Future tables created in the SQL editor may still receive
-- Supabase's default grants. Every new migration must revoke and grant explicitly.
-- Admin, vendor, and customer all connect as the authenticated role, so a column
-- that authenticated cannot write cannot be written by the Data API at all.
-- Status, role, and the other protected columns are changed by security-definer
-- functions (0019) or by triggers, which run as the table owner.
-- service_role is not granted or revoked here.

-- Helpers used by later policies. LANGUAGE plpgsql so PostgreSQL does not inline
-- them into the policy and re-apply RLS. search_path is fixed. row_security off
-- so a policy that calls them cannot recurse back into itself.

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
end;
$$;

comment on function public.is_admin() is
  'True when the current JWT profile has role admin. Bypasses RLS so profile policies can call it.';

create or replace function public.is_vendor_owner(vendor_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return vendor_id is not null and vendor_id = auth.uid();
end;
$$;

comment on function public.is_vendor_owner(uuid) is
  'True when vendor_id is the signed-in user. Shop primary key is the profile id.';

create or replace function public.is_approved_vendor()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.vendor_profiles
    where profile_id = auth.uid()
      and status = 'approved'
  );
end;
$$;

comment on function public.is_approved_vendor() is
  'True when the signed-in user has an approved shop.';

create or replace function public.vendor_is_approved(vendor_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.vendor_profiles
    where profile_id = vendor_is_approved.vendor_id
      and status = 'approved'
  );
end;
$$;

create or replace function public.owns_product(product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.products
    where id = owns_product.product_id
      and vendor_id = auth.uid()
  );
end;
$$;

create or replace function public.product_is_public(product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.products as product
    join public.vendor_profiles as shop on shop.profile_id = product.vendor_id
    where product.id = product_is_public.product_id
      and product.status = 'active'
      and shop.status = 'approved'
  );
end;
$$;

create or replace function public.customer_owns_order(order_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.orders
    where id = customer_owns_order.order_id
      and customer_id = auth.uid()
  );
end;
$$;

create or replace function public.vendor_on_order(order_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.order_items
    where order_items.order_id = vendor_on_order.order_id
      and vendor_id = auth.uid()
  );
end;
$$;

create or replace function public.customer_purchased_product(product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.order_items as item
    join public.orders as ord on ord.id = item.order_id
    where item.product_id = customer_purchased_product.product_id
      and ord.customer_id = auth.uid()
      and ord.status = 'delivered'
  );
end;
$$;

create or replace function public.owns_reel(reel_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.reels
    where id = owns_reel.reel_id
      and vendor_id = auth.uid()
  );
end;
$$;

create or replace function public.reel_is_public(reel_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.reels as reel
    join public.vendor_profiles as shop on shop.profile_id = reel.vendor_id
    where reel.id = reel_is_public.reel_id
      and reel.status = 'published'
      and shop.status = 'approved'
  );
end;
$$;

create or replace function public.owns_stream(stream_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.live_streams
    where id = owns_stream.stream_id
      and vendor_id = auth.uid()
  );
end;
$$;

create or replace function public.stream_is_public(stream_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.live_streams as stream
    join public.vendor_profiles as shop on shop.profile_id = stream.vendor_id
    where stream.id = stream_is_public.stream_id
      and stream.status in ('scheduled', 'live', 'ended')
      and shop.status = 'approved'
  );
end;
$$;

create or replace function public.stream_is_live(stream_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.live_streams as stream
    join public.vendor_profiles as shop on shop.profile_id = stream.vendor_id
    where stream.id = stream_is_live.stream_id
      and stream.status = 'live'
      and shop.status = 'approved'
  );
end;
$$;

create or replace function public.stream_chat_visible(stream_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.live_streams as stream
    join public.vendor_profiles as shop on shop.profile_id = stream.vendor_id
    where stream.id = stream_chat_visible.stream_id
      and stream.status in ('live', 'ended')
      and shop.status = 'approved'
  );
end;
$$;

create or replace function public.stream_lists_product(stream_id uuid, product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return stream_lists_product.product_id is not null
    and exists (
      select 1
      from public.live_stream_products
      where live_stream_products.stream_id = stream_lists_product.stream_id
        and live_stream_products.product_id = stream_lists_product.product_id
    );
end;
$$;

create or replace function public.conversation_participant(conversation_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.conversations
    where id = conversation_participant.conversation_id
      and auth.uid() in (customer_id, vendor_id)
  );
end;
$$;

create or replace function public.dispute_visible_to_vendor(order_id uuid, order_item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if dispute_visible_to_vendor.order_item_id is not null then
    return exists (
      select 1
      from public.order_items
      where id = dispute_visible_to_vendor.order_item_id
        and order_items.order_id = dispute_visible_to_vendor.order_id
        and vendor_id = auth.uid()
    );
  end if;

  return exists (
    select 1
    from public.order_items
    where order_items.order_id = dispute_visible_to_vendor.order_id
      and vendor_id = auth.uid()
  );
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_vendor_owner(uuid) from public;
revoke all on function public.is_approved_vendor() from public;
revoke all on function public.vendor_is_approved(uuid) from public;
revoke all on function public.owns_product(uuid) from public;
revoke all on function public.product_is_public(uuid) from public;
revoke all on function public.customer_owns_order(uuid) from public;
revoke all on function public.vendor_on_order(uuid) from public;
revoke all on function public.customer_purchased_product(uuid) from public;
revoke all on function public.owns_reel(uuid) from public;
revoke all on function public.reel_is_public(uuid) from public;
revoke all on function public.owns_stream(uuid) from public;
revoke all on function public.stream_is_public(uuid) from public;
revoke all on function public.stream_is_live(uuid) from public;
revoke all on function public.stream_chat_visible(uuid) from public;
revoke all on function public.stream_lists_product(uuid, uuid) from public;
revoke all on function public.conversation_participant(uuid) from public;
revoke all on function public.dispute_visible_to_vendor(uuid, uuid) from public;

-- Existing objects. Repeated runs are safe: revoke and grant are idempotent.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- The function revoke above also removes execute on trigger functions.
-- Restore the ones anon and authenticated must still call. Do not restore
-- eme_mark_internal_write or handle_new_user.
grant execute on function public.set_updated_at() to anon, authenticated;
grant execute on function public.guard_profile_role() to authenticated;
grant execute on function public.prevent_category_cycle() to anon, authenticated;
grant execute on function public.category_descendants(uuid) to anon, authenticated;
grant execute on function public.guard_product_counters() to anon, authenticated;
grant execute on function public.guard_vendor_followers() to anon, authenticated;
grant execute on function public.guard_reel_counters() to anon, authenticated;
grant execute on function public.guard_live_peak_viewers() to anon, authenticated;
grant execute on function public.sync_product_review_stats() to anon, authenticated;
grant execute on function public.sync_vendor_followers_count() to anon, authenticated;
grant execute on function public.sync_reel_likes_count() to anon, authenticated;
grant execute on function public.sync_reel_saves_count() to anon, authenticated;
grant execute on function public.sync_reel_comments_count() to anon, authenticated;
grant execute on function public.prevent_self_review() to anon, authenticated;
grant execute on function public.enforce_reel_product_vendor() to anon, authenticated;
grant execute on function public.enforce_reel_comment_parent() to anon, authenticated;
grant execute on function public.enforce_live_product_vendor() to anon, authenticated;
grant execute on function public.enforce_live_pin_vendor() to anon, authenticated;
grant execute on function public.enforce_message_participant() to anon, authenticated;
grant execute on function public.enforce_dispute_item_order() to anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_vendor_owner(uuid) to anon, authenticated;
grant execute on function public.is_approved_vendor() to anon, authenticated;
grant execute on function public.vendor_is_approved(uuid) to anon, authenticated;
grant execute on function public.owns_product(uuid) to anon, authenticated;
grant execute on function public.product_is_public(uuid) to anon, authenticated;
grant execute on function public.customer_owns_order(uuid) to anon, authenticated;
grant execute on function public.vendor_on_order(uuid) to anon, authenticated;
grant execute on function public.customer_purchased_product(uuid) to anon, authenticated;
grant execute on function public.owns_reel(uuid) to anon, authenticated;
grant execute on function public.reel_is_public(uuid) to anon, authenticated;
grant execute on function public.owns_stream(uuid) to anon, authenticated;
grant execute on function public.stream_is_public(uuid) to anon, authenticated;
grant execute on function public.stream_is_live(uuid) to anon, authenticated;
grant execute on function public.stream_chat_visible(uuid) to anon, authenticated;
grant execute on function public.stream_lists_product(uuid, uuid) to anon, authenticated;
grant execute on function public.conversation_participant(uuid) to anon, authenticated;
grant execute on function public.dispute_visible_to_vendor(uuid, uuid) to anon, authenticated;

-- Current role only. No "for role supabase_admin". A privilege error is a notice.
do $$
begin
  begin
    alter default privileges in schema public
      revoke all on tables from anon, authenticated;
  exception
    when insufficient_privilege then
      raise notice 'Skipped default table privileges for the current role: %', sqlerrm;
  end;

  begin
    alter default privileges in schema public
      revoke all on sequences from anon, authenticated;
  exception
    when insufficient_privilege then
      raise notice 'Skipped default sequence privileges for the current role: %', sqlerrm;
  end;

  begin
    alter default privileges in schema public
      revoke all on functions from anon, authenticated;
  exception
    when insufficient_privilege then
      raise notice 'Skipped default function privileges for the current role: %', sqlerrm;
  end;
end;
$$;

-- SELECT lists include counters and timestamps so a normal select works.
-- INSERT and UPDATE lists omit role, shop status, counters, money snapshots,
-- payment rows, and created_at / updated_at.

grant select (
  id, role, full_name, phone, avatar_url, created_at, updated_at
) on public.profiles to authenticated;

grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

grant select (
  profile_id, shop_name, slug, description, logo_url, banner_url,
  status, followers_count, created_at, updated_at
) on public.vendor_profiles to anon, authenticated;

grant insert (
  profile_id, shop_name, slug, description, logo_url, banner_url
) on public.vendor_profiles to authenticated;

grant update (
  shop_name, slug, description, logo_url, banner_url
) on public.vendor_profiles to authenticated;

grant delete on public.vendor_profiles to authenticated;

grant select (
  id, parent_id, name, slug, image_url, sort_order, is_active, created_at, updated_at
) on public.categories to anon, authenticated;

grant insert (
  parent_id, name, slug, image_url, sort_order, is_active
) on public.categories to authenticated;

grant update (
  parent_id, name, slug, image_url, sort_order, is_active
) on public.categories to authenticated;

grant delete on public.categories to authenticated;

grant select (
  id, vendor_id, category_id, title, slug, description, price, compare_at_price,
  currency, stock, sku, status, avg_rating, reviews_count, sales_count,
  search_vector, embedding, created_at, updated_at
) on public.products to anon, authenticated;

grant insert (
  vendor_id, category_id, title, slug, description, price, compare_at_price,
  currency, stock, sku, status
) on public.products to authenticated;

grant update (
  category_id, title, slug, description, price, compare_at_price,
  currency, stock, sku, status
) on public.products to authenticated;

grant delete on public.products to authenticated;

grant select (
  id, product_id, storage_path, sort_order, is_primary, created_at, updated_at
) on public.product_images to anon, authenticated;

grant insert (
  product_id, storage_path, sort_order, is_primary
) on public.product_images to authenticated;

grant update (storage_path, sort_order, is_primary) on public.product_images to authenticated;

grant delete on public.product_images to authenticated;

grant select (
  id, product_id, customer_id, rating, comment, created_at, updated_at
) on public.product_reviews to anon, authenticated;

grant insert (product_id, customer_id, rating, comment) on public.product_reviews to authenticated;

grant update (rating, comment) on public.product_reviews to authenticated;

grant delete on public.product_reviews to authenticated;

grant select (id, key, value, created_at, updated_at)
  on public.platform_settings to anon, authenticated;

grant insert (key, value) on public.platform_settings to authenticated;

grant update (key, value) on public.platform_settings to authenticated;

grant delete on public.platform_settings to authenticated;

grant select (
  id, customer_id, label, recipient_name, phone, line1, line2, city, district,
  postal_code, is_default, created_at, updated_at
) on public.addresses to authenticated;

grant insert (
  customer_id, label, recipient_name, phone, line1, line2, city, district,
  postal_code, is_default
) on public.addresses to authenticated;

grant update (
  label, recipient_name, phone, line1, line2, city, district, postal_code, is_default
) on public.addresses to authenticated;

grant delete on public.addresses to authenticated;

grant select (
  id, customer_id, product_id, quantity, created_at, updated_at
) on public.cart_items to authenticated;

grant insert (customer_id, product_id, quantity) on public.cart_items to authenticated;

grant update (quantity) on public.cart_items to authenticated;

grant delete on public.cart_items to authenticated;

grant select (
  id, customer_id, product_id, created_at, updated_at
) on public.wishlist_items to authenticated;

grant insert (customer_id, product_id) on public.wishlist_items to authenticated;

grant delete on public.wishlist_items to authenticated;

grant select (
  id, customer_id, vendor_id, created_at, updated_at
) on public.vendor_follows to authenticated;

grant insert (customer_id, vendor_id) on public.vendor_follows to authenticated;

grant delete on public.vendor_follows to authenticated;

grant select (
  id, customer_id, status, payment_status, subtotal, shipping_fee, total, currency,
  shipping_address, source, source_id, created_at, updated_at
) on public.orders to authenticated;

grant select (
  id, order_id, product_id, vendor_id, title, unit_price, quantity, line_total,
  item_status, created_at, updated_at
) on public.order_items to authenticated;

grant update (item_status) on public.order_items to authenticated;

grant select (
  id, order_id, provider, provider_reference, amount, currency, status,
  raw_payload, created_at, updated_at
) on public.payments to authenticated;

grant select (
  id, order_id, order_item_id, opened_by, reason, status, resolution_note,
  created_at, updated_at
) on public.disputes to authenticated;

grant insert (order_id, order_item_id, opened_by, reason) on public.disputes to authenticated;

grant update (status, resolution_note) on public.disputes to authenticated;

grant select (
  id, vendor_id, amount, currency, period_start, period_end, status, reference,
  created_at, updated_at
) on public.payouts to authenticated;

grant insert (
  vendor_id, amount, currency, period_start, period_end, status, reference
) on public.payouts to authenticated;

grant update (
  vendor_id, amount, currency, period_start, period_end, status, reference
) on public.payouts to authenticated;

grant delete on public.payouts to authenticated;

grant select (
  id, vendor_id, caption, video_path, thumbnail_path, duration_seconds, status,
  views_count, likes_count, comments_count, saves_count, shares_count, embedding,
  created_at, updated_at
) on public.reels to anon, authenticated;

grant insert (
  vendor_id, caption, video_path, thumbnail_path, duration_seconds, status
) on public.reels to authenticated;

grant update (
  caption, video_path, thumbnail_path, duration_seconds, status
) on public.reels to authenticated;

grant delete on public.reels to authenticated;

grant select (
  id, reel_id, product_id, sort_order, created_at, updated_at
) on public.reel_products to anon, authenticated;

grant insert (reel_id, product_id, sort_order) on public.reel_products to authenticated;

grant update (sort_order) on public.reel_products to authenticated;

grant delete on public.reel_products to authenticated;

grant select (id, reel_id, user_id, created_at, updated_at)
  on public.reel_likes to authenticated;

grant insert (reel_id, user_id) on public.reel_likes to authenticated;

grant delete on public.reel_likes to authenticated;

grant select (id, reel_id, user_id, created_at, updated_at)
  on public.reel_saves to authenticated;

grant insert (reel_id, user_id) on public.reel_saves to authenticated;

grant delete on public.reel_saves to authenticated;

grant select (
  id, reel_id, user_id, body, parent_id, created_at, updated_at
) on public.reel_comments to anon, authenticated;

grant insert (reel_id, user_id, body, parent_id) on public.reel_comments to authenticated;

grant delete on public.reel_comments to authenticated;

grant select (
  id, vendor_id, title, description, thumbnail_url, status, livekit_room_name,
  scheduled_at, started_at, ended_at, peak_viewers, pinned_product_id, embedding,
  created_at, updated_at
) on public.live_streams to anon, authenticated;

grant insert (
  vendor_id, title, description, thumbnail_url, status, livekit_room_name,
  scheduled_at, started_at, ended_at, pinned_product_id
) on public.live_streams to authenticated;

grant update (
  title, description, thumbnail_url, status, livekit_room_name,
  scheduled_at, started_at, ended_at, pinned_product_id
) on public.live_streams to authenticated;

grant delete on public.live_streams to authenticated;

grant select (
  id, stream_id, product_id, sort_order, created_at, updated_at
) on public.live_stream_products to anon, authenticated;

grant insert (stream_id, product_id, sort_order) on public.live_stream_products to authenticated;

grant update (sort_order) on public.live_stream_products to authenticated;

grant delete on public.live_stream_products to authenticated;

grant select (id, stream_id, user_id, body, created_at, updated_at)
  on public.live_messages to authenticated;

grant insert (stream_id, user_id, body) on public.live_messages to authenticated;

grant delete on public.live_messages to authenticated;

grant select (
  id, customer_id, vendor_id, product_id, created_at, updated_at
) on public.conversations to authenticated;

grant insert (customer_id, vendor_id, product_id) on public.conversations to authenticated;

grant select (
  id, conversation_id, sender_id, body, read_at, created_at, updated_at
) on public.messages to authenticated;

grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

grant update (read_at) on public.messages to authenticated;

grant select (
  id, user_id, session_id, event_type, entity_type, entity_id, metadata,
  created_at, updated_at
) on public.user_events to authenticated;

grant insert (
  session_id, event_type, entity_type, entity_id, metadata
) on public.user_events to anon;

grant insert (
  user_id, session_id, event_type, entity_type, entity_id, metadata
) on public.user_events to authenticated;
