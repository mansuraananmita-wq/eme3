-- 0004_vendors_categories.sql
-- Shops are separate from profiles.role. Approving a shop does not promote the user.

create table public.vendor_profiles (
  profile_id uuid primary key references public.profiles (id) on delete restrict,
  shop_name text not null,
  slug text not null,
  description text,
  logo_url text,
  banner_url text,
  status public.vendor_status not null default 'pending',
  followers_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_profiles_slug_unique unique (slug),
  constraint vendor_profiles_shop_name_len check (char_length(btrim(shop_name)) between 2 and 80),
  constraint vendor_profiles_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint vendor_profiles_followers_count_nonnegative check (followers_count >= 0)
);

comment on table public.vendor_profiles is
  'One shop per profile. status pending until an admin approves it. followers_count is trigger-maintained.';

comment on column public.vendor_profiles.followers_count is
  'Maintained by vendor_follows triggers. Direct writes are rejected.';

create index vendor_profiles_status_idx on public.vendor_profiles (status);
create index vendor_profiles_created_at_idx on public.vendor_profiles (created_at desc);
create index vendor_profiles_shop_name_trgm_idx
  on public.vendor_profiles using gin (shop_name extensions.gin_trgm_ops);

create trigger set_updated_at
before update on public.vendor_profiles
for each row
execute function public.set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null,
  slug text not null,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_unique unique (slug),
  constraint categories_name_len check (char_length(btrim(name)) between 2 and 80),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint categories_not_own_parent check (parent_id is distinct from id)
);

comment on table public.categories is
  'Unlimited category tree. parent_id null is a root. Deleting a parent is blocked while children exist.';

create index categories_parent_id_idx on public.categories (parent_id);
create index categories_is_active_idx on public.categories (is_active);
create index categories_created_at_idx on public.categories (created_at desc);
create index categories_parent_sort_idx on public.categories (parent_id, sort_order, name);
create index categories_name_trgm_idx
  on public.categories using gin (name extensions.gin_trgm_ops);

create trigger set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create or replace function public.prevent_category_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if exists (
    with recursive ancestors as (
      select id, parent_id
      from public.categories
      where id = new.parent_id
      union all
      select child.id, child.parent_id
      from public.categories as child
      join ancestors on child.id = ancestors.parent_id
    )
    select 1
    from ancestors
    where id = new.id
  ) then
    raise exception 'Category parent would create a cycle';
  end if;

  return new;
end;
$$;

create trigger prevent_category_cycle
before insert or update of parent_id on public.categories
for each row
execute function public.prevent_category_cycle();

create or replace function public.category_descendants(root_id uuid)
returns table (
  id uuid,
  parent_id uuid,
  name text,
  slug text,
  image_url text,
  sort_order integer,
  is_active boolean,
  depth integer
)
language sql
stable
set search_path = ''
as $$
  with recursive tree as (
    select
      c.id,
      c.parent_id,
      c.name,
      c.slug,
      c.image_url,
      c.sort_order,
      c.is_active,
      0 as depth
    from public.categories as c
    where c.id = root_id
    union all
    select
      child.id,
      child.parent_id,
      child.name,
      child.slug,
      child.image_url,
      child.sort_order,
      child.is_active,
      tree.depth + 1
    from public.categories as child
    join tree on child.parent_id = tree.id
  )
  select
    tree.id,
    tree.parent_id,
    tree.name,
    tree.slug,
    tree.image_url,
    tree.sort_order,
    tree.is_active,
    tree.depth
  from tree
  order by tree.depth, tree.sort_order, tree.name;
$$;

comment on function public.category_descendants(uuid) is
  'Returns the category itself at depth 0, then every descendant. Respects RLS of the caller.';

grant execute on function public.category_descendants(uuid) to anon, authenticated;
