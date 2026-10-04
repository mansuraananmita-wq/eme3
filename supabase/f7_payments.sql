-- f7_payments.sql
-- Idempotent payment settlement for orders that already exist.
-- Run in the Supabase SQL editor after f6_orders.sql.
--
-- What this does:
--   Delivered cash-on-delivery orders: payment_status and payments.status become paid.
--   Fully cancelled orders: a still-pending payment becomes failed.
--   Customer request_order_refund opens a dispute. It does not move money.
--   Admin admin_refund_order sets the order, lines, and payment to refunded.
--
-- bKash and Nagad are not implemented. There is no merchant key and no webhook.
-- Stock is not restored on refund: the goods were already delivered.

begin;

create or replace function public.f6_recompute_order_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_statuses public.order_item_status[];
  v_next public.order_status;
begin
  select array_agg(item_status)
  into v_statuses
  from public.order_items
  where order_id = p_order_id;

  if v_statuses is null or cardinality(v_statuses) = 0 then
    return;
  end if;

  if (select bool_and(s = 'cancelled') from unnest(v_statuses) as s) then
    v_next := 'cancelled';
  elsif (select bool_and(s in ('delivered', 'cancelled', 'refunded')) from unnest(v_statuses) as s)
        and (select bool_or(s = 'delivered') from unnest(v_statuses) as s) then
    v_next := 'delivered';
  elsif (select bool_or(s = 'shipped') from unnest(v_statuses) as s)
        or (select bool_or(s = 'delivered') from unnest(v_statuses) as s) then
    v_next := 'shipped';
  elsif (select bool_or(s = 'processing') from unnest(v_statuses) as s) then
    v_next := 'processing';
  else
    v_next := 'pending';
  end if;

  update public.orders
  set status = v_next
  where id = p_order_id
    and status is distinct from 'refunded'
    and status is distinct from v_next;

  if v_next = 'delivered' then
    update public.payments
    set status = 'paid'
    where order_id = p_order_id
      and provider = 'cash_on_delivery'
      and status = 'pending'
      and exists (
        select 1
        from public.orders as settled
        where settled.id = p_order_id
          and settled.status = 'delivered'
          and settled.payment_status = 'pending'
      );

    update public.orders
    set payment_status = 'paid'
    where id = p_order_id
      and status = 'delivered'
      and payment_status = 'pending';
  elsif v_next = 'cancelled' then
    update public.payments
    set status = 'failed'
    where order_id = p_order_id
      and status = 'pending';

    update public.orders
    set payment_status = 'failed'
    where id = p_order_id
      and status = 'cancelled'
      and payment_status = 'pending';
  end if;
end;
$$;

revoke all on function public.f6_recompute_order_status(uuid) from public;

-- Settle orders that were delivered or cancelled before this function existed.
update public.payments as payment
set status = 'paid'
from public.orders as ord
where payment.order_id = ord.id
  and ord.status = 'delivered'
  and ord.payment_status = 'pending'
  and payment.provider = 'cash_on_delivery'
  and payment.status = 'pending';

update public.orders as ord
set payment_status = 'paid'
where ord.status = 'delivered'
  and ord.payment_status = 'pending'
  and exists (
    select 1
    from public.payments as payment
    where payment.order_id = ord.id
      and payment.provider = 'cash_on_delivery'
      and payment.status = 'paid'
  );

update public.payments as payment
set status = 'failed'
from public.orders as ord
where payment.order_id = ord.id
  and ord.status = 'cancelled'
  and payment.status = 'pending';

update public.orders
set payment_status = 'failed'
where status = 'cancelled'
  and payment_status = 'pending';

-- ---------------------------------------------------------------------------
-- Customer asks for a refund after delivery. Opens a dispute. Does not pay out.
-- ---------------------------------------------------------------------------

create or replace function public.request_order_refund(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_dispute_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to request a refund.';
  end if;

  if char_length(v_reason) < 3 or char_length(v_reason) > 2000 then
    raise exception 'Refund reason must be 3 to 2000 characters.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
    and customer_id = v_uid
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'You can request a refund after the order is delivered.';
  end if;

  if v_order.payment_status in ('refunded', 'failed') then
    raise exception 'This payment cannot be refunded.';
  end if;

  if exists (
    select 1
    from public.disputes
    where order_id = p_order_id
      and status in ('open', 'investigating')
  ) then
    raise exception 'A refund request is already open for this order.';
  end if;

  insert into public.disputes (order_id, opened_by, reason)
  values (p_order_id, v_uid, v_reason)
  returning id into v_dispute_id;

  return jsonb_build_object(
    'dispute_id', v_dispute_id,
    'order_id', p_order_id,
    'status', 'open'
  );
end;
$$;

comment on function public.request_order_refund(uuid, text) is
  'Customer opens a dispute on their delivered order. An admin refunds it separately.';

revoke all on function public.request_order_refund(uuid, text) from public;
grant execute on function public.request_order_refund(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin refunds a delivered order. Does not restore stock.
-- ---------------------------------------------------------------------------

create or replace function public.admin_refund_order(
  p_order_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Only an admin can refund an order.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.status = 'refunded' or v_order.payment_status = 'refunded' then
    raise exception 'This order is already refunded.';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'Refund an order after it is delivered.';
  end if;

  update public.order_items
  set item_status = 'refunded'
  where order_id = p_order_id
    and item_status <> 'cancelled';

  update public.orders
  set
    status = 'refunded',
    payment_status = 'refunded'
  where id = p_order_id;

  update public.payments
  set status = 'refunded'
  where order_id = p_order_id
    and status in ('pending', 'paid');

  update public.disputes
  set
    status = 'resolved',
    resolution_note = coalesce(v_note, 'Refunded by admin.')
  where order_id = p_order_id
    and status in ('open', 'investigating');

  return jsonb_build_object(
    'order_id', p_order_id,
    'status', 'refunded',
    'payment_status', 'refunded'
  );
end;
$$;

comment on function public.admin_refund_order(uuid, text) is
  'Admin marks a delivered order and its cash payment refunded. Stock is left unchanged.';

revoke all on function public.admin_refund_order(uuid, text) from public;
grant execute on function public.admin_refund_order(uuid, text) to authenticated;

commit;
