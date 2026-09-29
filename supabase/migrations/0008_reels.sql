-- 0008_reels.sql
-- Short video. Counts for likes, comments, and saves are trigger-maintained.
-- views_count and shares_count are reserved for a later trusted writer.

create table public.reels (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles (profile_id) on delete restrict,
  caption text,
  video_path text,
  thumbnail_path text,
  duration_seconds integer,
  status public.reel_status not null default 'draft',
  views_count integer not null default 0,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  saves_count integer not null default 0,
  shares_count integer not null default 0,
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reels_caption_len check (
    caption is null or char_length(btrim(caption)) between 1 and 2000
  ),
  constraint reels_duration_nonnegative check (
    duration_seconds is null or duration_seconds >= 0
  ),
  constraint reels_published_has_video check (
    status <> 'published' or video_path is not null
  ),
  constraint reels_views_count_nonnegative check (views_count >= 0),
  constraint reels_likes_count_nonnegative check (likes_count >= 0),
  constraint reels_comments_count_nonnegative check (comments_count >= 0),
  constraint reels_saves_count_nonnegative check (saves_count >= 0),
  constraint reels_shares_count_nonnegative check (shares_count >= 0)
);

comment on table public.reels is
  'Vendor short video. A published reel must have video_path.';

comment on column public.reels.embedding is
  'Nullable semantic-search vector. Dimension is 768 for now and may change when the embedding model is chosen. Do not add an ANN index yet.';

create index reels_vendor_id_idx on public.reels (vendor_id);
create index reels_status_idx on public.reels (status);
create index reels_created_at_idx on public.reels (created_at desc);
create index reels_status_created_idx on public.reels (status, created_at desc);

create trigger set_updated_at
before update on public.reels
for each row
execute function public.set_updated_at();

create table public.reel_products (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reel_products_pair_unique unique (reel_id, product_id)
);

comment on table public.reel_products is
  'Products tagged on a reel. A trigger requires the product to belong to the reel vendor.';

create index reel_products_product_id_idx on public.reel_products (product_id);
create index reel_products_reel_sort_idx on public.reel_products (reel_id, sort_order);

create trigger set_updated_at
before update on public.reel_products
for each row
execute function public.set_updated_at();

create table public.reel_likes (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reel_likes_pair_unique unique (reel_id, user_id)
);

create index reel_likes_user_id_idx on public.reel_likes (user_id);
create index reel_likes_created_at_idx on public.reel_likes (created_at desc);

create trigger set_updated_at
before update on public.reel_likes
for each row
execute function public.set_updated_at();

create table public.reel_saves (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reel_saves_pair_unique unique (reel_id, user_id)
);

create index reel_saves_user_id_idx on public.reel_saves (user_id);
create index reel_saves_created_at_idx on public.reel_saves (created_at desc);

create trigger set_updated_at
before update on public.reel_saves
for each row
execute function public.set_updated_at();

create table public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  parent_id uuid references public.reel_comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reel_comments_body_len check (char_length(btrim(body)) between 1 and 2000),
  constraint reel_comments_not_own_parent check (parent_id is distinct from id)
);

comment on table public.reel_comments is
  'Top-level comments and replies. parent_id must point at a comment on the same reel. comments_count includes replies.';

create index reel_comments_reel_id_idx on public.reel_comments (reel_id, created_at);
create index reel_comments_user_id_idx on public.reel_comments (user_id);
create index reel_comments_parent_id_idx on public.reel_comments (parent_id);
create index reel_comments_created_at_idx on public.reel_comments (created_at desc);

create trigger set_updated_at
before update on public.reel_comments
for each row
execute function public.set_updated_at();
