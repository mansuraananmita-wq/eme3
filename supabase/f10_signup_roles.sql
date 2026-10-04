-- f10_signup_roles.sql
-- Paste once in the Supabase SQL editor.
-- After this, registration can choose customer, vendor, or admin.
-- A signed-in user can also switch that same account from the customer, vendor, or admin page.
-- You do not need the email UPDATE in admin_panel.sql anymore.

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('eme.allow_role_change', true), '') = '1'
       and new.role in ('customer', 'vendor', 'admin') then
      return new;
    end if;

    if session_user in ('postgres', 'supabase_admin') then
      return new;
    end if;

    new.role := 'customer';
    return new;
  end if;

  if new.role is not distinct from old.role then
    return new;
  end if;

  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if coalesce(current_setting('eme.allow_role_change', true), '') = '1' then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
  into actor_is_admin;

  if actor_is_admin then
    return new;
  end if;

  raise exception 'Only an admin can change a profile role';
end;
$$;

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
  if chosen not in ('customer', 'vendor', 'admin') then
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

comment on function public.handle_new_user() is
  'Creates the profile from signup. signup_role may be customer, vendor, or admin. Vendor signup also opens an approved shop so the studio and live hosting work.';

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
  if new_role not in ('customer', 'vendor', 'admin') then
    raise exception 'Pick customer, vendor, or admin';
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
  'Lets the signed-in user set their own role to customer, vendor, or admin. Vendor also opens or approves their shop. Before a public launch, revoke execute from authenticated.';

revoke all on function public.claim_account_role(text, text) from public, anon;
grant execute on function public.claim_account_role(text, text) to authenticated;
