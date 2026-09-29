-- 0014_policies_core.sql
-- Run after 0013. Profiles, shops, catalog, reviews, and platform settings.
-- Helpers are security definer, so these policies do not subquery the same table.

create view public.public_profiles
with (security_invoker = false, security_barrier = true) as
select id, full_name, avatar_url
from public.profiles;

comment on view public.public_profiles is
  'Name and avatar for comment and chat authors. Phone is not in this view. Email lives only in auth.users. The view runs as its owner so a reader who cannot select profiles can still see an author. Do not add columns. Write access is not granted.';

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

create policy profiles_select_own on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

create policy vendor_profiles_select on public.vendor_profiles
for select to anon, authenticated
using (
  status = 'approved'
  or profile_id = (select auth.uid())
  or public.is_admin()
);

create policy vendor_profiles_insert_application on public.vendor_profiles
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and status = 'pending'
  and followers_count = 0
);

create policy vendor_profiles_update_own on public.vendor_profiles
for update to authenticated
using (profile_id = (select auth.uid()) or public.is_admin())
with check (
  public.is_admin()
  or (
    profile_id = (select auth.uid())
    and public.is_vendor_owner(profile_id)
  )
);

create policy vendor_profiles_delete_admin on public.vendor_profiles
for delete to authenticated
using (public.is_admin());

create policy categories_select_active on public.categories
for select to anon, authenticated
using (is_active or public.is_admin());

create policy categories_write_admin on public.categories
for insert to authenticated
with check (public.is_admin());

create policy categories_update_admin on public.categories
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy categories_delete_admin on public.categories
for delete to authenticated
using (public.is_admin());

create policy products_select on public.products
for select to anon, authenticated
using (
  public.is_admin()
  or vendor_id = (select auth.uid())
  or (
    status = 'active'
    and public.vendor_is_approved(vendor_id)
  )
);

create policy products_insert on public.products
for insert to authenticated
with check (
  public.is_admin()
  or (
    vendor_id = (select auth.uid())
    and public.is_approved_vendor()
  )
);

create policy products_update on public.products
for update to authenticated
using (
  public.is_admin()
  or (
    vendor_id = (select auth.uid())
    and public.is_approved_vendor()
  )
)
with check (
  public.is_admin()
  or (
    vendor_id = (select auth.uid())
    and public.is_approved_vendor()
  )
);

create policy products_delete on public.products
for delete to authenticated
using (
  public.is_admin()
  or (
    vendor_id = (select auth.uid())
    and public.is_approved_vendor()
  )
);

create policy product_images_select on public.product_images
for select to anon, authenticated
using (
  public.is_admin()
  or public.owns_product(product_id)
  or public.product_is_public(product_id)
);

create policy product_images_insert on public.product_images
for insert to authenticated
with check (
  public.is_admin()
  or (
    public.owns_product(product_id)
    and public.is_approved_vendor()
  )
);

create policy product_images_update on public.product_images
for update to authenticated
using (
  public.is_admin()
  or (
    public.owns_product(product_id)
    and public.is_approved_vendor()
  )
)
with check (
  public.is_admin()
  or (
    public.owns_product(product_id)
    and public.is_approved_vendor()
  )
);

create policy product_images_delete on public.product_images
for delete to authenticated
using (
  public.is_admin()
  or (
    public.owns_product(product_id)
    and public.is_approved_vendor()
  )
);

create policy product_reviews_select on public.product_reviews
for select to anon, authenticated
using (true);

create policy product_reviews_insert on public.product_reviews
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and public.customer_purchased_product(product_id)
);

create policy product_reviews_update on public.product_reviews
for update to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

create policy product_reviews_delete on public.product_reviews
for delete to authenticated
using (customer_id = (select auth.uid()) or public.is_admin());

create policy platform_settings_select on public.platform_settings
for select to anon, authenticated
using (true);

create policy platform_settings_insert_admin on public.platform_settings
for insert to authenticated
with check (public.is_admin());

create policy platform_settings_update_admin on public.platform_settings
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy platform_settings_delete_admin on public.platform_settings
for delete to authenticated
using (public.is_admin());

comment on table public.platform_settings is
  'Public platform config such as commission and the default shipping fee. No secrets, API keys, webhook secrets, or service credentials belong in this table.';
