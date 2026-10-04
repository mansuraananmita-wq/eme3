-- f8_live_guest_chat.sql
-- Guests may read chat on a public live or ended room.
-- Sending a message still requires a signed-in user (existing insert policy).
-- Run in the Supabase SQL editor after 0016.

begin;

grant select (
  id, stream_id, user_id, body, created_at, updated_at
) on public.live_messages to anon;

drop policy if exists live_messages_select_anon on public.live_messages;
create policy live_messages_select_anon on public.live_messages
for select to anon
using (public.stream_chat_visible(stream_id));

commit;
