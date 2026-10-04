-- f6_orders.sql
-- Idempotent F6 checkout RPCs: place_order, cancel_my_order, vendor_set_item_status.
-- Tables already exist (0006 addresses/cart, 0007 orders). No client INSERT on orders/payments.
-- Run in Supabase SQL Editor after migrations 0001–0019 (and grants/policies).
--
-- Shipping (server-side, never trust the browser):
--   Dhaka (city or district contains 'dhaka'): 60 BDT
--   Outside Dhaka: 120 BDT
-- Matches web/js/api/checkoutApi.js DELIVERY_FEES.
--
-- order_status / order_item_status have no 'confirmed' — vendors use 'processing'.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.f6_shipping_fee(p_city text, p_district text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(p_city, '')) like '%dhaka%'
      or lower(coalesce(p_district, '')) like '%dhaka%'
    then 60::numeric
    else 120::numeric
  end;
$$;

comment on function public.f6_shipping_fee(text, text) is
  'Delivery fee: 60 BDT in Dhaka, 120 BDT outside. Used by place_order.';

revoke all on function public.f6_shipping_fee(text, text) from public;
grant execute on function public.f6_shipping_fee(text, text) to authenticated;

create or replace function public.f6_item_status_allowed(
  p_from public.order_item_status,
  p_to public.order_item_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_from = p_to then true
    when p_from = 'pending' and p_to in ('processing', 'cancelled') then true
    when p_from = 'processing' and p_to in ('shipped', 'cancelled') then true
    when p_from = 'shipped' and p_to = 'delivered' then true
    else false
  end;
$$;

revoke all on function public.f6_item_status_allowed(public.order_item_status, public.order_item_status) from public;
grant execute on function public.f6_item_status_allowed(public.order_item_status, public.order_item_status) to authenticated;

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

  -- COD is collected when the order is delivered. Cancelled orders never collect it.
  -- Do not touch a refunded order, or a payment that is already paid or failed.
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

-- ---------------------------------------------------------------------------
-- place_order: COD only for now. Prices and stock verified server-side.
-- p_product_id + p_quantity = buy-now (one line). Otherwise uses cart_items.
-- Returns jsonb: { "order_id": "<uuid>" }
-- ---------------------------------------------------------------------------

create or replace function public.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_product_id uuid default null,
  p_quantity integer default null,
  p_source public.order_source default 'direct',
  p_source_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_address public.addresses%rowtype;
  v_shipping numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_currency text := 'BDT';
  v_order_id uuid;
  v_source public.order_source := coalesce(p_source, 'direct');
  v_source_id uuid := p_source_id;
  r record;
  v_qty integer;
  v_line_count integer := 0;
  v_want integer;
  v_take integer;
begin
  if v_uid is null then
    raise exception 'Sign in to place an order.';
  end if;

  if coalesce(p_payment_method, '') <> 'cash_on_delivery' then
    raise exception 'Only cash on delivery is available right now.';
  end if;

  if v_source = 'direct' then
    v_source_id := null;
  elsif v_source_id is null then
    raise exception 'source_id is required for reel or live orders.';
  end if;

  select *
  into v_address
  from public.addresses
  where id = p_address_id
    and customer_id = v_uid;

  if not found then
    raise exception 'Choose a valid delivery address.';
  end if;

  v_shipping := public.f6_shipping_fee(v_address.city, v_address.district);

  drop table if exists pg_temp._f6_lines;
  create temporary table _f6_lines (
    product_id uuid primary key,
    vendor_id uuid not null,
    title text not null,
    unit_price numeric(12, 2) not null,
    quantity integer not null,
    currency text not null
  ) on commit drop;

  if p_product_id is not null then
    v_want := greatest(1, coalesce(p_quantity, 1));
    select
      p.id,
      p.vendor_id,
      p.title,
      p.price,
      p.stock,
      p.currency
    into r
    from public.products as p
    join public.vendor_profiles as vp on vp.profile_id = p.vendor_id
    where p.id = p_product_id
      and p.status = 'active'
      and vp.status = 'approved'
    for update of p;

    if not found or r.stock < 1 then
      raise exception 'That product is not available.';
    end if;

    v_take := least(v_want, r.stock);
    insert into _f6_lines (product_id, vendor_id, title, unit_price, quantity, currency)
    values (r.id, r.vendor_id, r.title, r.price, v_take, r.currency);
  else
    for r in
      select
        p.id,
        p.vendor_id,
        p.title,
        p.price,
        p.stock,
        p.currency,
        c.quantity as cart_qty
      from public.cart_items as c
      join public.products as p on p.id = c.product_id
      join public.vendor_profiles as vp on vp.profile_id = p.vendor_id
      where c.customer_id = v_uid
        and p.status = 'active'
        and vp.status = 'approved'
        and p.stock > 0
        and c.quantity > 0
      for update of p
    loop
      v_take := least(r.cart_qty, r.stock);
      insert into _f6_lines (product_id, vendor_id, title, unit_price, quantity, currency)
      values (r.id, r.vendor_id, r.title, r.price, v_take, r.currency);
    end loop;
  end if;

  select count(*) into v_line_count from _f6_lines;
  if v_line_count < 1 then
    raise exception 'Your cart is empty or items are out of stock.';
  end if;

  select coalesce(sum(round(unit_price * quantity, 2)), 0), max(currency)
  into v_subtotal, v_currency
  from _f6_lines;

  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    v_currency := 'BDT';
  end if;

  v_total := v_subtotal + v_shipping;

  insert into public.orders (
    customer_id,
    status,
    payment_status,
    subtotal,
    shipping_fee,
    total,
    currency,
    shipping_address,
    source,
    source_id
  ) values (
    v_uid,
    'pending',
    'pending',
    v_subtotal,
    v_shipping,
    v_total,
    v_currency,
    jsonb_build_object(
      'label', v_address.label,
      'recipient_name', v_address.recipient_name,
      'phone', v_address.phone,
      'line1', v_address.line1,
      'line2', v_address.line2,
      'city', v_address.city,
      'district', v_address.district,
      'postal_code', v_address.postal_code
    ),
    v_source,
    v_source_id
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, vendor_id, title, unit_price, quantity, item_status
  )
  select
    v_order_id,
    product_id,
    vendor_id,
    title,
    unit_price,
    quantity,
    'pending'
  from _f6_lines;

  insert into public.payments (
    order_id,
    provider,
    provider_reference,
    amount,
    currency,
    status,
    raw_payload
  ) values (
    v_order_id,
    'cash_on_delivery',
    'cod-' || v_order_id::text,
    v_total,
    v_currency,
    'pending',
    jsonb_build_object('method', 'cash_on_delivery')
  );

  perform set_config('eme.internal_write', '1', true);
  for r in select * from _f6_lines loop
    update public.products
    set
      stock = stock - r.quantity,
      sales_count = sales_count + r.quantity
    where id = r.product_id
      and stock >= r.quantity;

    if not found then
      raise exception 'Stock changed while placing the order. Try again.';
    end if;
  end loop;
  perform set_config('eme.internal_write', '', true);

  if p_product_id is null then
    delete from public.cart_items
    where customer_id = v_uid
      and product_id in (select product_id from _f6_lines);
  else
    delete from public.cart_items
    where customer_id = v_uid
      and product_id = p_product_id;
  end if;

  return jsonb_build_object('order_id', v_order_id);
exception
  when others then
    perform set_config('eme.internal_write', '', true);
    raise;
end;
$$;

comment on function public.place_order(uuid, text, uuid, integer, public.order_source, uuid) is
  'Secure checkout. Verifies stock and prices server-side. COD only. One order with multi-vendor lines.';

revoke all on function public.place_order(uuid, text, uuid, integer, public.order_source, uuid) from public;
grant execute on function public.place_order(uuid, text, uuid, integer, public.order_source, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_my_order: customer may cancel only own pending orders; restores stock.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_my_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  r record;
begin
  if v_uid is null then
    raise exception 'Sign in to cancel an order.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and customer_id = v_uid
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Only pending orders can be cancelled.';
  end if;

  perform set_config('eme.internal_write', '1', true);
  for r in
    select product_id, quantity
    from public.order_items
    where order_id = p_order_id
      and item_status = 'pending'
  loop
    update public.products
    set
      stock = stock + r.quantity,
      sales_count = greatest(0, sales_count - r.quantity)
    where id = r.product_id;
  end loop;
  perform set_config('eme.internal_write', '', true);

  update public.order_items
  set item_status = 'cancelled'
  where order_id = p_order_id
    and item_status = 'pending';

  update public.orders
  set status = 'cancelled'
  where id = p_order_id;

  update public.payments
  set status = 'failed'
  where order_id = p_order_id
    and status = 'pending';

  return jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
exception
  when others then
    perform set_config('eme.internal_write', '', true);
    raise;
end;
$$;

revoke all on function public.cancel_my_order(uuid) from public;
grant execute on function public.cancel_my_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- vendor_set_item_status: own lines only, allowed transitions, recompute order.
-- ---------------------------------------------------------------------------

create or replace function public.vendor_set_item_status(
  p_item_id uuid,
  p_status public.order_item_status
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item public.order_items%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required.';
  end if;

  if not public.is_approved_vendor() then
    raise exception 'Only approved vendors can update order items.';
  end if;

  select * into v_item
  from public.order_items
  where id = p_item_id
    and vendor_id = v_uid
  for update;

  if not found then
    raise exception 'Order item not found.';
  end if;

  if not public.f6_item_status_allowed(v_item.item_status, p_status) then
    raise exception 'Invalid status change from % to %.', v_item.item_status, p_status;
  end if;

  -- Restore stock when vendor cancels a still-pending/processing line.
  if p_status = 'cancelled' and v_item.item_status in ('pending', 'processing') then
    perform set_config('eme.internal_write', '1', true);
    update public.products
    set
      stock = stock + v_item.quantity,
      sales_count = greatest(0, sales_count - v_item.quantity)
    where id = v_item.product_id;
    perform set_config('eme.internal_write', '', true);
  end if;

  update public.order_items
  set item_status = p_status
  where id = p_item_id;

  perform public.f6_recompute_order_status(v_item.order_id);

  return jsonb_build_object(
    'item_id', p_item_id,
    'item_status', p_status,
    'order_id', v_item.order_id
  );
exception
  when others then
    perform set_config('eme.internal_write', '', true);
    raise;
end;
$$;

revoke all on function public.vendor_set_item_status(uuid, public.order_item_status) from public;
grant execute on function public.vendor_set_item_status(uuid, public.order_item_status) to authenticated;

commit;

-- Quick check (safe to run; returns function names)
select p.proname
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('place_order', 'cancel_my_order', 'vendor_set_item_status', 'f6_shipping_fee')
order by 1;
