-- 0011_counter_and_integrity.sql
-- Run after 0010. Does not enable RLS and does not add policies.
-- Counter columns are recounted here. Clients cannot write them.
-- views_count, shares_count, sales_count, and peak_viewers are locked too.
-- Nothing in this file writes those four yet.

create or replace function public.guard_product_counters()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('eme.internal_write', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.avg_rating := 0;
    new.reviews_count := 0;
    new.sales_count := 0;
    return new;
  end if;

  if new.avg_rating is distinct from old.avg_rating
     or new.reviews_count is distinct from old.reviews_count
     or new.sales_count is distinct from old.sales_count
  then
    raise exception 'Product rating and sales counters are maintained by the database';
  end if;

  return new;
end;
$$;

create trigger guard_product_counters
before insert or update on public.products
for each row
execute function public.guard_product_counters();

create or replace function public.guard_vendor_followers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('eme.internal_write', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.followers_count := 0;
    return new;
  end if;

  if new.followers_count is distinct from old.followers_count then
    raise exception 'followers_count is maintained by the database';
  end if;

  return new;
end;
$$;

create trigger guard_vendor_followers
before insert or update on public.vendor_profiles
for each row
execute function public.guard_vendor_followers();

create or replace function public.guard_reel_counters()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('eme.internal_write', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.views_count := 0;
    new.likes_count := 0;
    new.comments_count := 0;
    new.saves_count := 0;
    new.shares_count := 0;
    return new;
  end if;

  if new.views_count is distinct from old.views_count
     or new.likes_count is distinct from old.likes_count
     or new.comments_count is distinct from old.comments_count
     or new.saves_count is distinct from old.saves_count
     or new.shares_count is distinct from old.shares_count
  then
    raise exception 'Reel counters are maintained by the database';
  end if;

  return new;
end;
$$;

create trigger guard_reel_counters
before insert or update on public.reels
for each row
execute function public.guard_reel_counters();

create or replace function public.guard_live_peak_viewers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('eme.internal_write', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.peak_viewers := 0;
    return new;
  end if;

  if new.peak_viewers is distinct from old.peak_viewers then
    raise exception 'peak_viewers is maintained by the database';
  end if;

  return new;
end;
$$;

create trigger guard_live_peak_viewers
before insert or update on public.live_streams
for each row
execute function public.guard_live_peak_viewers();

create or replace function public.sync_product_review_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  targets uuid[] := '{}';
begin
  if tg_op = 'DELETE' then
    targets := array[old.product_id];
  elsif tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    targets := array[old.product_id, new.product_id];
  else
    targets := array[new.product_id];
  end if;

  foreach target in array targets loop
    begin
      perform public.eme_mark_internal_write();
      update public.products as product
      set
        reviews_count = stats.reviews_count,
        avg_rating = stats.avg_rating
      from (
        select
          count(*)::integer as reviews_count,
          coalesce(round(avg(review.rating)::numeric, 2), 0)::numeric(3, 2) as avg_rating
        from public.product_reviews as review
        where review.product_id = target
      ) as stats
      where product.id = target;
      perform set_config('eme.internal_write', '', true);
    exception
      when sqlstate '27000' then
        perform set_config('eme.internal_write', '', true);
    end;
  end loop;

  return coalesce(new, old);
end;
$$;

comment on function public.sync_product_review_stats() is
  'Recounts products.reviews_count and products.avg_rating after a review change.';

create trigger sync_product_review_stats
after insert or update or delete on public.product_reviews
for each row
execute function public.sync_product_review_stats();

create or replace function public.sync_vendor_followers_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  targets uuid[] := '{}';
begin
  if tg_op = 'DELETE' then
    targets := array[old.vendor_id];
  elsif tg_op = 'UPDATE' and old.vendor_id is distinct from new.vendor_id then
    targets := array[old.vendor_id, new.vendor_id];
  else
    targets := array[new.vendor_id];
  end if;

  foreach target in array targets loop
    begin
      perform public.eme_mark_internal_write();
      update public.vendor_profiles as shop
      set followers_count = (
        select count(*)::integer
        from public.vendor_follows as follow
        where follow.vendor_id = target
      )
      where shop.profile_id = target;
      perform set_config('eme.internal_write', '', true);
    exception
      when sqlstate '27000' then
        perform set_config('eme.internal_write', '', true);
    end;
  end loop;

  return coalesce(new, old);
end;
$$;

create trigger sync_vendor_followers_count
after insert or update or delete on public.vendor_follows
for each row
execute function public.sync_vendor_followers_count();

create or replace function public.sync_reel_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  targets uuid[] := '{}';
begin
  if tg_op = 'DELETE' then
    targets := array[old.reel_id];
  elsif tg_op = 'UPDATE' and old.reel_id is distinct from new.reel_id then
    targets := array[old.reel_id, new.reel_id];
  else
    targets := array[new.reel_id];
  end if;

  foreach target in array targets loop
    begin
      perform public.eme_mark_internal_write();
      update public.reels as reel
      set likes_count = (
        select count(*)::integer
        from public.reel_likes as like_row
        where like_row.reel_id = target
      )
      where reel.id = target;
      perform set_config('eme.internal_write', '', true);
    exception
      when sqlstate '27000' then
        perform set_config('eme.internal_write', '', true);
    end;
  end loop;

  return coalesce(new, old);
end;
$$;

create trigger sync_reel_likes_count
after insert or update or delete on public.reel_likes
for each row
execute function public.sync_reel_likes_count();

create or replace function public.sync_reel_saves_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  targets uuid[] := '{}';
begin
  if tg_op = 'DELETE' then
    targets := array[old.reel_id];
  elsif tg_op = 'UPDATE' and old.reel_id is distinct from new.reel_id then
    targets := array[old.reel_id, new.reel_id];
  else
    targets := array[new.reel_id];
  end if;

  foreach target in array targets loop
    begin
      perform public.eme_mark_internal_write();
      update public.reels as reel
      set saves_count = (
        select count(*)::integer
        from public.reel_saves as save_row
        where save_row.reel_id = target
      )
      where reel.id = target;
      perform set_config('eme.internal_write', '', true);
    exception
      when sqlstate '27000' then
        perform set_config('eme.internal_write', '', true);
    end;
  end loop;

  return coalesce(new, old);
end;
$$;

create trigger sync_reel_saves_count
after insert or update or delete on public.reel_saves
for each row
execute function public.sync_reel_saves_count();

create or replace function public.sync_reel_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  targets uuid[] := '{}';
begin
  if tg_op = 'DELETE' then
    targets := array[old.reel_id];
  elsif tg_op = 'UPDATE' and old.reel_id is distinct from new.reel_id then
    targets := array[old.reel_id, new.reel_id];
  else
    targets := array[new.reel_id];
  end if;

  foreach target in array targets loop
    begin
      perform public.eme_mark_internal_write();
      update public.reels as reel
      set comments_count = (
        select count(*)::integer
        from public.reel_comments as comment_row
        where comment_row.reel_id = target
      )
      where reel.id = target;
      perform set_config('eme.internal_write', '', true);
    exception
      when others then
        perform set_config('eme.internal_write', '', true);
    end;
  end loop;

  return coalesce(new, old);
end;
$$;

comment on function public.sync_reel_comments_count() is
  'comments_count includes top-level comments and replies.';

create trigger sync_reel_comments_count
after insert or update or delete on public.reel_comments
for each row
execute function public.sync_reel_comments_count();

create or replace function public.prevent_self_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.products
    where id = new.product_id
      and vendor_id = new.customer_id
  ) then
    raise exception 'A shop cannot review its own product';
  end if;

  return new;
end;
$$;

create trigger prevent_self_review
before insert or update on public.product_reviews
for each row
execute function public.prevent_self_review();

create or replace function public.enforce_reel_product_vendor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.reels as reel
    join public.products as product on product.id = new.product_id
    where reel.id = new.reel_id
      and product.vendor_id = reel.vendor_id
  ) then
    raise exception 'A reel can only tag products from the same shop';
  end if;

  return new;
end;
$$;

create trigger enforce_reel_product_vendor
before insert or update on public.reel_products
for each row
execute function public.enforce_reel_product_vendor();

create or replace function public.enforce_reel_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if exists (
    with recursive chain as (
      select id, parent_id, reel_id
      from public.reel_comments
      where id = new.parent_id
      union all
      select comment_row.id, comment_row.parent_id, comment_row.reel_id
      from public.reel_comments as comment_row
      join chain on comment_row.id = chain.parent_id
    )
    select 1
    from chain
    where reel_id is distinct from new.reel_id
       or id = new.id
  ) then
    raise exception 'A reply must stay on the same reel and cannot cycle';
  end if;

  if not exists (
    select 1
    from public.reel_comments
    where id = new.parent_id
  ) then
    raise exception 'Reply parent was not found';
  end if;

  return new;
end;
$$;

create trigger enforce_reel_comment_parent
before insert or update of parent_id, reel_id on public.reel_comments
for each row
execute function public.enforce_reel_comment_parent();

create or replace function public.enforce_live_product_vendor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.live_streams as stream
    join public.products as product on product.id = new.product_id
    where stream.id = new.stream_id
      and product.vendor_id = stream.vendor_id
  ) then
    raise exception 'A live room can only feature products from the same shop';
  end if;

  return new;
end;
$$;

create trigger enforce_live_product_vendor
before insert or update on public.live_stream_products
for each row
execute function public.enforce_live_product_vendor();

create or replace function public.enforce_live_pin_vendor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pinned_product_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.products
    where id = new.pinned_product_id
      and vendor_id = new.vendor_id
  ) then
    raise exception 'Pinned product must belong to the same shop';
  end if;

  return new;
end;
$$;

create trigger enforce_live_pin_vendor
before insert or update of pinned_product_id, vendor_id on public.live_streams
for each row
execute function public.enforce_live_pin_vendor();

create or replace function public.enforce_message_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.conversations
    where id = new.conversation_id
      and new.sender_id in (customer_id, vendor_id)
  ) then
    raise exception 'Sender is not part of this conversation';
  end if;

  return new;
end;
$$;

create trigger enforce_message_participant
before insert or update of sender_id, conversation_id on public.messages
for each row
execute function public.enforce_message_participant();

create or replace function public.enforce_dispute_item_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_item_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.order_items
    where id = new.order_item_id
      and order_id = new.order_id
  ) then
    raise exception 'order_item_id does not belong to order_id';
  end if;

  return new;
end;
$$;

create trigger enforce_dispute_item_order
before insert or update of order_id, order_item_id on public.disputes
for each row
execute function public.enforce_dispute_item_order();

revoke all on function public.guard_product_counters() from public;
revoke all on function public.guard_vendor_followers() from public;
revoke all on function public.guard_reel_counters() from public;
revoke all on function public.guard_live_peak_viewers() from public;
revoke all on function public.sync_product_review_stats() from public;
revoke all on function public.sync_vendor_followers_count() from public;
revoke all on function public.sync_reel_likes_count() from public;
revoke all on function public.sync_reel_saves_count() from public;
revoke all on function public.sync_reel_comments_count() from public;
revoke all on function public.prevent_self_review() from public;
revoke all on function public.enforce_reel_product_vendor() from public;
revoke all on function public.enforce_reel_comment_parent() from public;
revoke all on function public.enforce_live_product_vendor() from public;
revoke all on function public.enforce_live_pin_vendor() from public;
revoke all on function public.enforce_message_participant() from public;
revoke all on function public.enforce_dispute_item_order() from public;

-- Triggers run as the role that wrote the row, so that role needs EXECUTE.
-- These functions return trigger and cannot be called as normal API functions.
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
