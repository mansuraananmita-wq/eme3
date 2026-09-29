-- 0015_policies_commerce.sql
-- Run after 0014. Cart, addresses, orders, payments, follows, disputes, payouts.
-- There is no insert policy on orders or payments. A later checkout function writes
-- orders. The payment webhook, using the service role Supabase already has, writes payments.

create policy addresses_all_own on public.addresses
for all to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

create policy cart_items_all_own on public.cart_items
for all to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

create policy wishlist_items_all_own on public.wishlist_items
for all to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

create policy vendor_follows_all_own on public.vendor_follows
for all to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

create policy orders_select on public.orders
for select to authenticated
using (
  public.is_admin()
  or customer_id = (select auth.uid())
  or public.vendor_on_order(id)
);

create policy order_items_select on public.order_items
for select to authenticated
using (
  public.is_admin()
  or vendor_id = (select auth.uid())
  or public.customer_owns_order(order_id)
);

create policy order_items_update_status on public.order_items
for update to authenticated
using (
  vendor_id = (select auth.uid())
  and public.is_approved_vendor()
)
with check (
  vendor_id = (select auth.uid())
  and public.is_approved_vendor()
);

create policy payments_select on public.payments
for select to authenticated
using (
  public.is_admin()
  or public.customer_owns_order(order_id)
);

create policy disputes_insert_customer on public.disputes
for insert to authenticated
with check (
  opened_by = (select auth.uid())
  and status = 'open'
  and public.customer_owns_order(order_id)
);

create policy disputes_select on public.disputes
for select to authenticated
using (
  public.is_admin()
  or opened_by = (select auth.uid())
  or public.dispute_visible_to_vendor(order_id, order_item_id)
);

create policy disputes_update_admin on public.disputes
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy payouts_select on public.payouts
for select to authenticated
using (vendor_id = (select auth.uid()) or public.is_admin());

create policy payouts_insert_admin on public.payouts
for insert to authenticated
with check (public.is_admin());

create policy payouts_update_admin on public.payouts
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy payouts_delete_admin on public.payouts
for delete to authenticated
using (public.is_admin());
