-- 0007_orders.sql
-- Orders keep a snapshot of the address and of each line.
-- source_id points at a reel or a live stream. It is not a foreign key.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12, 2) not null,
  shipping_fee numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  currency text not null default 'BDT',
  shipping_address jsonb not null,
  source public.order_source not null default 'direct',
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_subtotal_nonnegative check (subtotal >= 0),
  constraint orders_shipping_fee_nonnegative check (shipping_fee >= 0),
  constraint orders_total_nonnegative check (total >= 0),
  constraint orders_total_equals_parts check (total = subtotal + shipping_fee),
  constraint orders_currency_code check (currency ~ '^[A-Z]{3}$'),
  constraint orders_shipping_address_object check (jsonb_typeof(shipping_address) = 'object'),
  constraint orders_source_id_shape check (
    (source = 'direct' and source_id is null)
    or (source in ('reel', 'live') and source_id is not null)
  )
);

comment on table public.orders is
  'Customer order. Totals are in currency (BDT by default). Line items are snapshotted and are not required by a constraint to sum to subtotal; the checkout function must write them together.';

comment on column public.orders.shipping_address is
  'Snapshot at purchase. Expected keys: label, recipient_name, phone, line1, line2, city, district, postal_code.';

comment on column public.orders.source_id is
  'Polymorphic. When source is reel, this is reels.id. When source is live, this is live_streams.id. No foreign key, because the target table depends on source.';

create index orders_customer_id_idx on public.orders (customer_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_source_idx on public.orders (source, source_id);

create trigger set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  vendor_id uuid not null references public.vendor_profiles (profile_id) on delete restrict,
  title text not null,
  unit_price numeric(12, 2) not null,
  quantity integer not null,
  line_total numeric(12, 2) generated always as (round(unit_price * quantity, 2)) stored,
  item_status public.order_item_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_title_len check (char_length(btrim(title)) between 1 and 180),
  constraint order_items_unit_price_nonnegative check (unit_price >= 0),
  constraint order_items_quantity_positive check (quantity > 0)
);

comment on table public.order_items is
  'Frozen title and unit price. product_id and vendor_id stay restrict-on-delete so order history cannot disappear with a catalog edit.';

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index order_items_vendor_id_idx on public.order_items (vendor_id);
create index order_items_item_status_idx on public.order_items (item_status);
create index order_items_created_at_idx on public.order_items (created_at desc);

create trigger set_updated_at
before update on public.order_items
for each row
execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null,
  provider_reference text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'BDT',
  status public.payment_status not null default 'pending',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_reference_unique unique (provider_reference),
  constraint payments_provider_len check (char_length(btrim(provider)) between 2 and 40),
  constraint payments_amount_nonnegative check (amount >= 0),
  constraint payments_currency_code check (currency ~ '^[A-Z]{3}$'),
  constraint payments_raw_payload_object check (jsonb_typeof(raw_payload) = 'object')
);

comment on table public.payments is
  'One row per provider attempt. provider_reference is unique. raw_payload must not contain card numbers or secrets.';

create index payments_order_id_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);
create index payments_created_at_idx on public.payments (created_at desc);

create trigger set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();
