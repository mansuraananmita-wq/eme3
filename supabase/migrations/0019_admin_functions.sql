-- 0019_admin_functions.sql
-- Run after 0018. Admin-only writes that column grants deliberately block.
-- Callable by authenticated. is_admin() is checked inside each function.
-- The SQL editor can still update these rows directly because it bypasses RLS
-- and column privileges as the table owner. The Data API cannot.

create or replace function public.approve_vendor(vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can approve a vendor';
  end if;

  if not exists (
    select 1
    from public.vendor_profiles
    where profile_id = approve_vendor.vendor_id
  ) then
    raise exception 'Vendor was not found';
  end if;

  select role
  into current_role
  from public.profiles
  where id = approve_vendor.vendor_id;

  if current_role is null then
    raise exception 'Profile was not found';
  end if;

  update public.vendor_profiles
  set status = 'approved'
  where profile_id = approve_vendor.vendor_id;

  -- An admin who also owns a shop keeps role admin.
  -- A customer (or an existing vendor) becomes vendor in the same transaction.
  if current_role <> 'admin' then
    update public.profiles
    set role = 'vendor'
    where id = approve_vendor.vendor_id;
  end if;
end;
$$;

comment on function public.approve_vendor(uuid) is
  'Sets the shop to approved and, unless the profile is already admin, sets role to vendor. Both writes are in one transaction.';

create or replace function public.suspend_vendor(vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can suspend a vendor';
  end if;

  update public.vendor_profiles
  set status = 'suspended'
  where profile_id = suspend_vendor.vendor_id;

  if not found then
    raise exception 'Vendor was not found';
  end if;
end;
$$;

comment on function public.suspend_vendor(uuid) is
  'Sets the shop to suspended. Public policies then hide that shop''s products, reels, and streams. Their own status values are left unchanged so a later approval shows them again. The profile role stays vendor.';

create or replace function public.set_user_role(user_id uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change a role';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = set_user_role.user_id
  ) then
    raise exception 'Profile was not found';
  end if;

  if set_user_role.user_id = auth.uid() and new_role <> 'admin' then
    select count(*)
    into admin_count
    from public.profiles
    where role = 'admin';

    if admin_count <= 1 then
      raise exception 'Refusing to remove the last admin';
    end if;
  end if;

  update public.profiles
  set role = new_role
  where id = set_user_role.user_id;
end;
$$;

comment on function public.set_user_role(uuid, public.user_role) is
  'Sets profiles.role. Refuses to demote the last admin. Does not approve or suspend a shop.';

revoke all on function public.approve_vendor(uuid) from public, anon;
revoke all on function public.suspend_vendor(uuid) from public, anon;
revoke all on function public.set_user_role(uuid, public.user_role) from public, anon;

grant execute on function public.approve_vendor(uuid) to authenticated;
grant execute on function public.suspend_vendor(uuid) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
