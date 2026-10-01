-- reels_policies.sql
-- Idempotent companion to migrations 0016_policies_content.sql and 0017_storage.sql.
-- Run in Supabase SQL Editor if reel RLS or Storage was skipped during migration.
-- Safe to re-run: drops and recreates the same policy names where privileges allow.

begin;

-- reels: public read published + approved shop; vendors CRUD own (not removed); admin override
drop policy if exists reels_select on public.reels;
create policy reels_select on public.reels
for select to anon, authenticated
using (
  public.is_admin()
  or vendor_id = (select auth.uid())
  or (
    status = 'published'
    and public.vendor_is_approved(vendor_id)
  )
);

drop policy if exists reels_insert on public.reels;
create policy reels_insert on public.reels
for insert to authenticated
with check (
  vendor_id = (select auth.uid())
  and public.is_approved_vendor()
  and status in ('draft', 'published')
);

drop policy if exists reels_update on public.reels;
create policy reels_update on public.reels
for update to authenticated
using (
  public.is_admin()
  or (
    vendor_id = (select auth.uid())
    and public.is_approved_vendor()
    and status <> 'removed'
  )
)
with check (
  public.is_admin()
  or (
    vendor_id = (select auth.uid())
    and public.is_approved_vendor()
    and status in ('draft', 'published')
  )
);

drop policy if exists reels_delete on public.reels;
create policy reels_delete on public.reels
for delete to authenticated
using (
  public.is_admin()
  or (
    vendor_id = (select auth.uid())
    and public.is_approved_vendor()
    and status <> 'removed'
  )
);

-- reel_products: tag only own products on own reels
drop policy if exists reel_products_select on public.reel_products;
create policy reel_products_select on public.reel_products
for select to anon, authenticated
using (
  public.is_admin()
  or public.owns_reel(reel_id)
  or public.reel_is_public(reel_id)
);

drop policy if exists reel_products_insert on public.reel_products;
create policy reel_products_insert on public.reel_products
for insert to authenticated
with check (
  public.is_approved_vendor()
  and public.owns_reel(reel_id)
  and public.owns_product(product_id)
);

drop policy if exists reel_products_update on public.reel_products;
create policy reel_products_update on public.reel_products
for update to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor()
    and public.owns_reel(reel_id)
    and public.owns_product(product_id)
  )
)
with check (
  public.is_admin()
  or (
    public.is_approved_vendor()
    and public.owns_reel(reel_id)
    and public.owns_product(product_id)
  )
);

drop policy if exists reel_products_delete on public.reel_products;
create policy reel_products_delete on public.reel_products
for delete to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor()
    and public.owns_reel(reel_id)
  )
);

-- reel_likes: own rows only
drop policy if exists reel_likes_select_own on public.reel_likes;
create policy reel_likes_select_own on public.reel_likes
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists reel_likes_insert_own on public.reel_likes;
create policy reel_likes_insert_own on public.reel_likes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (public.reel_is_public(reel_id) or public.owns_reel(reel_id))
);

drop policy if exists reel_likes_delete_own on public.reel_likes;
create policy reel_likes_delete_own on public.reel_likes
for delete to authenticated
using (user_id = (select auth.uid()));

-- reel_comments: public read on public reels; insert authenticated; delete own (vendor can delete on own reel via 0016)
drop policy if exists reel_comments_select on public.reel_comments;
create policy reel_comments_select on public.reel_comments
for select to anon, authenticated
using (
  public.is_admin()
  or public.owns_reel(reel_id)
  or public.reel_is_public(reel_id)
);

drop policy if exists reel_comments_insert on public.reel_comments;
create policy reel_comments_insert on public.reel_comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    public.reel_is_public(reel_id)
    or public.owns_reel(reel_id)
  )
);

drop policy if exists reel_comments_delete on public.reel_comments;
create policy reel_comments_delete on public.reel_comments
for delete to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
  or (
    public.owns_reel(reel_id)
    and public.is_approved_vendor()
  )
);

commit;

-- Storage (reel-videos, reel-thumbnails): public read; writes only in {auth.uid()}/… — see 0017_storage.sql eme_storage_* policies.
