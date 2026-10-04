-- Close the self-serve admin door, and fill catalog embeddings from titles.
-- No outside API. The vector is a hashed bag of words (768 dims, cosine).
-- Run once in the SQL editor. Safe to run again.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen text;
  shop text;
  base_slug text;
  final_slug text;
  n integer := 0;
begin
  chosen := lower(btrim(coalesce(new.raw_user_meta_data ->> 'signup_role', 'customer')));
  if chosen not in ('customer', 'vendor') then
    chosen := 'customer';
  end if;

  perform set_config('eme.allow_role_change', '1', true);

  insert into public.profiles (id, role, full_name, avatar_url)
  values (
    new.id,
    chosen::public.user_role,
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      ''
    ),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  );

  if chosen <> 'vendor' then
    return new;
  end if;

  shop := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'shop_name', '')), '');
  if shop is null then
    shop := nullif(
      btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')),
      ''
    );
  end if;
  if shop is null or char_length(shop) < 2 then
    shop := 'My shop';
  end if;
  if char_length(shop) > 80 then
    shop := left(shop, 80);
  end if;

  base_slug := trim(both '-' from lower(regexp_replace(shop, '[^a-zA-Z0-9]+', '-', 'g')));
  if base_slug is null or base_slug = '' or base_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    base_slug := 'shop';
  end if;
  base_slug := left(base_slug, 40);
  final_slug := base_slug;

  while exists (select 1 from public.vendor_profiles where slug = final_slug) loop
    n := n + 1;
    final_slug := base_slug || '-' || n::text;
    if n > 50 then
      final_slug := base_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 8);
      exit;
    end if;
  end loop;

  insert into public.vendor_profiles (profile_id, shop_name, slug, status)
  values (new.id, shop, final_slug, 'approved');

  return new;
end;
$$;

create or replace function public.claim_account_role(new_role text, shop_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  uid uuid := auth.uid();
  shop text;
  base_slug text;
  final_slug text;
  n integer := 0;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;

  new_role := lower(btrim(coalesce(new_role, '')));
  if new_role = 'admin' then
    raise exception 'Admin is not a self-serve role';
  end if;
  if new_role not in ('customer', 'vendor') then
    raise exception 'Pick customer or vendor';
  end if;

  perform set_config('eme.allow_role_change', '1', true);

  update public.profiles
  set role = new_role::public.user_role
  where id = uid;

  if new_role <> 'vendor' then
    return;
  end if;

  if exists (select 1 from public.vendor_profiles where profile_id = uid) then
    update public.vendor_profiles
    set status = 'approved'
    where profile_id = uid
      and status = 'pending';
    return;
  end if;

  shop := nullif(btrim(coalesce(shop_name, '')), '');
  if shop is null then
    select nullif(btrim(coalesce(full_name, '')), '')
    into shop
    from public.profiles
    where id = uid;
  end if;
  if shop is null or char_length(shop) < 2 then
    shop := 'My shop';
  end if;
  if char_length(shop) > 80 then
    shop := left(shop, 80);
  end if;

  base_slug := trim(both '-' from lower(regexp_replace(shop, '[^a-zA-Z0-9]+', '-', 'g')));
  if base_slug is null or base_slug = '' or base_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    base_slug := 'shop';
  end if;
  base_slug := left(base_slug, 40);
  final_slug := base_slug;

  while exists (select 1 from public.vendor_profiles where slug = final_slug) loop
    n := n + 1;
    final_slug := base_slug || '-' || n::text;
    if n > 50 then
      final_slug := base_slug || '-' || substr(replace(uid::text, '-', ''), 1, 8);
      exit;
    end if;
  end loop;

  insert into public.vendor_profiles (profile_id, shop_name, slug, status)
  values (uid, shop, final_slug, 'approved');
end;
$$;

comment on function public.claim_account_role(text, text) is
  'Lets the signed-in user set their own role to customer or vendor. Admin cannot be claimed from the browser.';

create or replace function public.eme_text_embedding(source text)
returns extensions.vector(768)
language plpgsql
immutable
set search_path = pg_catalog, public, extensions
as $$
declare
  weights float8[] := array_fill(0::float8, array[768]);
  token text;
  slot integer;
  norm float8 := 0;
  i integer;
  parts text[] := '{}';
begin
  if source is null or btrim(source) = '' then
    return null;
  end if;

  for token in
    select lower(match[1])
    from regexp_matches(source, '[[:alnum:]]{2,}', 'g') as match
  loop
    slot := mod(hashtext(token), 768);
    if slot < 0 then
      slot := slot + 768;
    end if;
    weights[slot + 1] := weights[slot + 1] + 1;
  end loop;

  for i in 1..768 loop
    norm := norm + weights[i] * weights[i];
  end loop;
  norm := sqrt(norm);
  if norm = 0 then
    return null;
  end if;

  for i in 1..768 loop
    parts := parts || trim(to_char(weights[i] / norm, 'FM999990.000000'));
  end loop;

  return ('[' || array_to_string(parts, ',') || ']')::extensions.vector(768);
end;
$$;

revoke all on function public.eme_text_embedding(text) from public, anon, authenticated;

create or replace function public.products_set_embedding()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  new.embedding := public.eme_text_embedding(concat_ws(' ', new.title, new.description));
  return new;
end;
$$;

drop trigger if exists products_set_embedding on public.products;
create trigger products_set_embedding
before insert or update of title, description on public.products
for each row
execute function public.products_set_embedding();

create or replace function public.reels_set_embedding()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  new.embedding := public.eme_text_embedding(new.caption);
  return new;
end;
$$;

drop trigger if exists reels_set_embedding on public.reels;
create trigger reels_set_embedding
before insert or update of caption on public.reels
for each row
execute function public.reels_set_embedding();

create or replace function public.live_streams_set_embedding()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  new.embedding := public.eme_text_embedding(new.title);
  return new;
end;
$$;

drop trigger if exists live_streams_set_embedding on public.live_streams;
create trigger live_streams_set_embedding
before insert or update of title on public.live_streams
for each row
execute function public.live_streams_set_embedding();

update public.products
set embedding = public.eme_text_embedding(concat_ws(' ', title, description))
where title is not null;

update public.reels
set embedding = public.eme_text_embedding(caption)
where caption is not null;

update public.live_streams
set embedding = public.eme_text_embedding(title)
where title is not null;

create index if not exists products_embedding_hnsw
  on public.products
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create index if not exists reels_embedding_hnsw
  on public.reels
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create index if not exists live_streams_embedding_hnsw
  on public.live_streams
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create or replace function public.match_product_ids(query text, match_count integer default 8)
returns setof uuid
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
set row_security = off
as $$
  select product.id
  from public.products as product
  join public.vendor_profiles as shop on shop.profile_id = product.vendor_id
  where product.status = 'active'
    and shop.status = 'approved'
    and product.embedding is not null
    and public.eme_text_embedding(query) is not null
  order by product.embedding <=> public.eme_text_embedding(query)
  limit least(greatest(coalesce(match_count, 8), 1), 24);
$$;

revoke all on function public.match_product_ids(text, integer) from public;
grant execute on function public.match_product_ids(text, integer) to anon, authenticated;

comment on function public.match_product_ids(text, integer) is
  'Nearest active products for a catalog question. Uses the hashed title embedding, not an outside model.';
