-- 0006_customers.sql
-- Addresses, cart, wishlist, and shop follows.

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  district text not null,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_label_len check (char_length(btrim(label)) between 1 and 40),
  constraint addresses_recipient_len check (char_length(btrim(recipient_name)) between 2 and 120),
  constraint addresses_phone_len check (char_length(btrim(phone)) between 6 and 20),
  constraint addresses_line1_len check (char_length(btrim(line1)) between 3 and 180),
  constraint addresses_city_len check (char_length(btrim(city)) between 2 and 80),
  constraint addresses_district_len check (char_length(btrim(district)) between 2 and 80)
);

comment on table public.addresses is
  'Saved delivery addresses. At most one is_default per customer.';

create index addresses_customer_id_idx on public.addresses (customer_id);
create unique index addresses_one_default_idx
  on public.addresses (customer_id)
  where is_default;

create trigger set_updated_at
before update on public.addresses
for each row
execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_customer_product_unique unique (customer_id, product_id),
  constraint cart_items_quantity_positive check (quantity > 0)
);

create index cart_items_product_id_idx on public.cart_items (product_id);
create index cart_items_created_at_idx on public.cart_items (created_at desc);

create trigger set_updated_at
before update on public.cart_items
for each row
execute function public.set_updated_at();

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wishlist_items_customer_product_unique unique (customer_id, product_id)
);

create index wishlist_items_product_id_idx on public.wishlist_items (product_id);
create index wishlist_items_created_at_idx on public.wishlist_items (created_at desc);

create trigger set_updated_at
before update on public.wishlist_items
for each row
execute function public.set_updated_at();

create table public.vendor_follows (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  vendor_id uuid not null references public.vendor_profiles (profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_follows_pair_unique unique (customer_id, vendor_id),
  constraint vendor_follows_not_self check (customer_id <> vendor_id)
);

comment on table public.vendor_follows is
  'Customer follows a shop. Inserts and deletes maintain vendor_profiles.followers_count.';

create index vendor_follows_vendor_id_idx on public.vendor_follows (vendor_id);
create index vendor_follows_created_at_idx on public.vendor_follows (created_at desc);

create trigger set_updated_at
before update on public.vendor_follows
for each row
execute function public.set_updated_at();
