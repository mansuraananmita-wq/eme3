-- 0005_catalog.sql
-- Products, images, and reviews. Slugs are unique inside products.
-- search_vector is generated. embedding is reserved for later semantic search.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles (profile_id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null,
  slug text not null,
  description text,
  price numeric(12, 2) not null,
  compare_at_price numeric(12, 2),
  currency text not null default 'BDT',
  stock integer not null default 0,
  sku text,
  status public.product_status not null default 'draft',
  avg_rating numeric(3, 2) not null default 0,
  reviews_count integer not null default 0,
  sales_count integer not null default 0,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored,
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_unique unique (slug),
  constraint products_title_len check (char_length(btrim(title)) between 2 and 180),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_price_nonnegative check (price >= 0),
  constraint products_compare_at_price_nonnegative check (
    compare_at_price is null or compare_at_price >= 0
  ),
  constraint products_compare_at_price_gte_price check (
    compare_at_price is null or compare_at_price >= price
  ),
  constraint products_currency_code check (currency ~ '^[A-Z]{3}$'),
  constraint products_stock_nonnegative check (stock >= 0),
  constraint products_avg_rating_range check (avg_rating >= 0 and avg_rating <= 5),
  constraint products_reviews_count_nonnegative check (reviews_count >= 0),
  constraint products_sales_count_nonnegative check (sales_count >= 0)
);

comment on table public.products is
  'Vendor catalog item. avg_rating, reviews_count, and sales_count are not client-writable.';

comment on column public.products.search_vector is
  'Generated from title (weight A) and description (weight B) with the simple text search config, so Bangla and English titles are not stemmed away.';

comment on column public.products.embedding is
  'Nullable semantic-search vector. Dimension is 768 for now and may change when the embedding model is chosen. Do not add an ANN index yet.';

create unique index products_vendor_sku_unique
  on public.products (vendor_id, sku)
  where sku is not null;

create index products_vendor_id_idx on public.products (vendor_id);
create index products_category_id_idx on public.products (category_id);
create index products_status_idx on public.products (status);
create index products_created_at_idx on public.products (created_at desc);
create index products_status_created_idx on public.products (status, created_at desc);
create index products_search_vector_idx on public.products using gin (search_vector);
create index products_title_trgm_idx
  on public.products using gin (title extensions.gin_trgm_ops);

create trigger set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_path_len check (char_length(btrim(storage_path)) between 1 and 500)
);

comment on table public.product_images is
  'storage_path is a Supabase Storage path, or a full URL if the file is already public. At most one primary image per product.';

create index product_images_product_id_idx on public.product_images (product_id, sort_order);
create unique index product_images_one_primary_idx
  on public.product_images (product_id)
  where is_primary;

create trigger set_updated_at
before update on public.product_images
for each row
execute function public.set_updated_at();

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_reviews_one_per_customer unique (product_id, customer_id),
  constraint product_reviews_rating_range check (rating between 1 and 5),
  constraint product_reviews_comment_len check (
    comment is null or char_length(btrim(comment)) between 1 and 2000
  )
);

comment on table public.product_reviews is
  'One review per customer per product. A shop cannot review its own product. Stats are trigger-maintained.';

create index product_reviews_customer_id_idx on public.product_reviews (customer_id);
create index product_reviews_created_at_idx on public.product_reviews (created_at desc);

create trigger set_updated_at
before update on public.product_reviews
for each row
execute function public.set_updated_at();
