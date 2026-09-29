-- 0009_live.sql
-- Live shopping rooms. livekit_room_name is the LiveKit room, not a secret key.

create table public.live_streams (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles (profile_id) on delete restrict,
  title text not null,
  description text,
  thumbnail_url text,
  status public.live_status not null default 'scheduled',
  livekit_room_name text not null,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  peak_viewers integer not null default 0,
  pinned_product_id uuid references public.products (id) on delete set null,
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_streams_room_unique unique (livekit_room_name),
  constraint live_streams_title_len check (char_length(btrim(title)) between 2 and 140),
  constraint live_streams_room_format check (livekit_room_name ~ '^[A-Za-z0-9_-]{1,128}$'),
  constraint live_streams_scheduled_has_time check (
    status <> 'scheduled' or scheduled_at is not null
  ),
  constraint live_streams_ended_after_start check (
    ended_at is null or started_at is null or ended_at >= started_at
  ),
  constraint live_streams_peak_viewers_nonnegative check (peak_viewers >= 0)
);

comment on table public.live_streams is
  'One LiveKit room per stream. peak_viewers is not client-writable. pinned_product_id must belong to the same shop.';

comment on column public.live_streams.embedding is
  'Nullable semantic-search vector. Dimension is 768 for now and may change when the embedding model is chosen. Do not add an ANN index yet.';

create index live_streams_vendor_id_idx on public.live_streams (vendor_id);
create index live_streams_status_idx on public.live_streams (status);
create index live_streams_created_at_idx on public.live_streams (created_at desc);
create index live_streams_scheduled_at_idx on public.live_streams (scheduled_at);
create index live_streams_pinned_product_id_idx on public.live_streams (pinned_product_id);

create trigger set_updated_at
before update on public.live_streams
for each row
execute function public.set_updated_at();

create table public.live_stream_products (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_stream_products_pair_unique unique (stream_id, product_id)
);

comment on table public.live_stream_products is
  'Products attached to a live room. The product must belong to the stream vendor.';

create index live_stream_products_product_id_idx on public.live_stream_products (product_id);
create index live_stream_products_stream_sort_idx
  on public.live_stream_products (stream_id, sort_order);

create trigger set_updated_at
before update on public.live_stream_products
for each row
execute function public.set_updated_at();

create table public.live_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_messages_body_len check (char_length(btrim(body)) between 1 and 500)
);

create index live_messages_stream_id_idx on public.live_messages (stream_id, created_at);
create index live_messages_user_id_idx on public.live_messages (user_id);
create index live_messages_created_at_idx on public.live_messages (created_at desc);

create trigger set_updated_at
before update on public.live_messages
for each row
execute function public.set_updated_at();
