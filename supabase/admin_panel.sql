-- admin_panel.sql
-- Idempotent admin RPCs for the minimal admin panel.
-- Role is profiles.role = 'admin', checked with public.is_admin() (migration 0013).
-- Vendor status enum is pending | approved | suspended. There is no 'rejected'.
-- Product hide value is 'archived'. Reel hide value is 'removed'. Rows are not deleted.
-- Run after migrations through 0019 (approve_vendor / suspend_vendor must exist).

begin;

-- ---------------------------------------------------------------------------
-- Gate the admin page. Returns false for everyone who is not an admin.
-- ---------------------------------------------------------------------------

create or replace function public.admin_panel_access()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return public.is_admin();
end;
$$;

comment on function public.admin_panel_access() is
  'True only when auth.uid() has profiles.role = admin.';

revoke all on function public.admin_panel_access() from public, anon;
grant execute on function public.admin_panel_access() to authenticated;

-- ---------------------------------------------------------------------------
-- Shop status. approved / suspended delegate to the existing admin functions
-- so role promotion stays in one place. pending only resets the shop status.
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_vendor_status(
  vendor_id uuid,
  new_status public.vendor_status
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change a shop status';
  end if;

  if new_status = 'approved' then
    perform public.approve_vendor(admin_set_vendor_status.vendor_id);
  elsif new_status = 'suspended' then
    perform public.suspend_vendor(admin_set_vendor_status.vendor_id);
  elsif new_status = 'pending' then
    update public.vendor_profiles
    set status = 'pending'
    where profile_id = admin_set_vendor_status.vendor_id;

    if not found then
      raise exception 'Vendor was not found';
    end if;
  else
    raise exception 'Unsupported vendor status';
  end if;
end;
$$;

comment on function public.admin_set_vendor_status(uuid, public.vendor_status) is
  'Admin-only. approved calls approve_vendor, suspended calls suspend_vendor.';

revoke all on function public.admin_set_vendor_status(uuid, public.vendor_status) from public, anon;
grant execute on function public.admin_set_vendor_status(uuid, public.vendor_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Reel status. Remove from the public feed by setting status = removed.
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_reel_status(
  reel_id uuid,
  new_status public.reel_status
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change a reel status';
  end if;

  update public.reels
  set status = new_status
  where id = admin_set_reel_status.reel_id;

  if not found then
    raise exception 'Reel was not found';
  end if;
end;
$$;

comment on function public.admin_set_reel_status(uuid, public.reel_status) is
  'Admin-only reel status. Use removed to hide a reel without deleting the row.';

revoke all on function public.admin_set_reel_status(uuid, public.reel_status) from public, anon;
grant execute on function public.admin_set_reel_status(uuid, public.reel_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Product status. Remove from the catalog by setting status = archived.
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_product_status(
  product_id uuid,
  new_status public.product_status
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change a product status';
  end if;

  update public.products
  set status = new_status
  where id = admin_set_product_status.product_id;

  if not found then
    raise exception 'Product was not found';
  end if;
end;
$$;

comment on function public.admin_set_product_status(uuid, public.product_status) is
  'Admin-only product status. Use archived to hide a product without deleting the row.';

revoke all on function public.admin_set_product_status(uuid, public.product_status) from public, anon;
grant execute on function public.admin_set_product_status(uuid, public.product_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Read policies. Recreated with the same rules as 0014 / 0015 so this file
-- can be pasted again. Customers and vendors keep their existing access.
-- Admins already could read every shop and every order; that is unchanged.
-- ---------------------------------------------------------------------------

drop policy if exists vendor_profiles_select on public.vendor_profiles;
create policy vendor_profiles_select on public.vendor_profiles
for select to anon, authenticated
using (
  status = 'approved'
  or profile_id = (select auth.uid())
  or public.is_admin()
);

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
for select to authenticated
using (
  public.is_admin()
  or customer_id = (select auth.uid())
  or public.vendor_on_order(id)
);

commit;

-- First admin (SQL editor, table owner). There is no rejected vendor status.
-- update public.profiles as p
-- set role = 'admin'
-- from auth.users as u
-- where p.id = u.id
--   and u.email = 'you@example.com';
