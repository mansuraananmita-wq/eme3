-- 0016_policies_content.sql
-- Run after 0015. Reels, live rooms, chat, and behavior events.
-- A reel or stream with status removed can be changed only by an admin.

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

create policy reels_insert on public.reels
for insert to authenticated
with check (
  vendor_id = (select auth.uid())
  and public.is_approved_vendor()
  and status in ('draft', 'published')
);

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

create policy reel_products_select on public.reel_products
for select to anon, authenticated
using (
  public.is_admin()
  or public.owns_reel(reel_id)
  or public.reel_is_public(reel_id)
);

create policy reel_products_insert on public.reel_products
for insert to authenticated
with check (
  public.is_approved_vendor()
  and public.owns_reel(reel_id)
  and public.owns_product(product_id)
);

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

create policy reel_products_delete on public.reel_products
for delete to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor()
    and public.owns_reel(reel_id)
  )
);

create policy reel_likes_select_own on public.reel_likes
for select to authenticated
using (user_id = (select auth.uid()));

create policy reel_likes_insert_own on public.reel_likes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (public.reel_is_public(reel_id) or public.owns_reel(reel_id))
);

create policy reel_likes_delete_own on public.reel_likes
for delete to authenticated
using (user_id = (select auth.uid()));

create policy reel_saves_select_own on public.reel_saves
for select to authenticated
using (user_id = (select auth.uid()));

create policy reel_saves_insert_own on public.reel_saves
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (public.reel_is_public(reel_id) or public.owns_reel(reel_id))
);

create policy reel_saves_delete_own on public.reel_saves
for delete to authenticated
using (user_id = (select auth.uid()));

create policy reel_comments_select on public.reel_comments
for select to anon, authenticated
using (
  public.is_admin()
  or public.owns_reel(reel_id)
  or public.reel_is_public(reel_id)
);

create policy reel_comments_insert on public.reel_comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    public.reel_is_public(reel_id)
    or public.owns_reel(reel_id)
  )
);

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

create policy live_streams_select on public.live_streams
for select to anon, authenticated
using (
  public.is_admin()
  or vendor_id = (select auth.uid())
  or public.stream_is_public(id)
);

create policy live_streams_insert on public.live_streams
for insert to authenticated
with check (
  vendor_id = (select auth.uid())
  and public.is_approved_vendor()
  and status in ('scheduled', 'live', 'ended')
  and (
    pinned_product_id is null
    or public.stream_lists_product(id, pinned_product_id)
  )
);

create policy live_streams_update on public.live_streams
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
  (
    public.is_admin()
    or (
      vendor_id = (select auth.uid())
      and public.is_approved_vendor()
      and status in ('scheduled', 'live', 'ended')
    )
  )
  and (
    pinned_product_id is null
    or public.stream_lists_product(id, pinned_product_id)
  )
);

create policy live_streams_delete on public.live_streams
for delete to authenticated
using (
  public.is_admin()
  or (
    vendor_id = (select auth.uid())
    and public.is_approved_vendor()
    and status <> 'removed'
  )
);

create policy live_stream_products_select on public.live_stream_products
for select to anon, authenticated
using (
  public.is_admin()
  or public.owns_stream(stream_id)
  or public.stream_is_public(stream_id)
);

create policy live_stream_products_insert on public.live_stream_products
for insert to authenticated
with check (
  public.is_approved_vendor()
  and public.owns_stream(stream_id)
  and public.owns_product(product_id)
);

create policy live_stream_products_update on public.live_stream_products
for update to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor()
    and public.owns_stream(stream_id)
  )
)
with check (
  public.is_admin()
  or (
    public.is_approved_vendor()
    and public.owns_stream(stream_id)
    and public.owns_product(product_id)
  )
);

create policy live_stream_products_delete on public.live_stream_products
for delete to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor()
    and public.owns_stream(stream_id)
  )
);

create policy live_messages_select on public.live_messages
for select to authenticated
using (
  public.is_admin()
  or public.owns_stream(stream_id)
  or public.stream_chat_visible(stream_id)
);

create policy live_messages_insert on public.live_messages
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.stream_is_live(stream_id)
);

create policy live_messages_delete on public.live_messages
for delete to authenticated
using (
  public.is_admin()
  or (
    public.owns_stream(stream_id)
    and public.is_approved_vendor()
  )
);

create policy conversations_select on public.conversations
for select to authenticated
using (
  public.is_admin()
  or customer_id = (select auth.uid())
  or vendor_id = (select auth.uid())
);

create policy conversations_insert_customer on public.conversations
for insert to authenticated
with check (customer_id = (select auth.uid()));

create policy messages_select on public.messages
for select to authenticated
using (
  public.is_admin()
  or public.conversation_participant(conversation_id)
);

create policy messages_insert on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.conversation_participant(conversation_id)
);

create policy messages_update_read on public.messages
for update to authenticated
using (
  public.conversation_participant(conversation_id)
  and sender_id <> (select auth.uid())
)
with check (
  public.conversation_participant(conversation_id)
  and sender_id <> (select auth.uid())
);

create policy user_events_insert_anon on public.user_events
for insert to anon
with check (user_id is null);

create policy user_events_insert_user on public.user_events
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy user_events_select_admin on public.user_events
for select to authenticated
using (public.is_admin());
