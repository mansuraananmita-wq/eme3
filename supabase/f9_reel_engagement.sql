-- f9_reel_engagement.sql
-- Trusted writers for reel views and shares. Clients cannot update those columns.
-- A view is counted once per browser session. A share is counted once per session.
-- Run in the Supabase SQL editor after migrations 0001–0019.

begin;

create or replace function public.record_reel_view(
  p_reel_id uuid,
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_session text := btrim(coalesce(p_session_id, ''));
begin
  if char_length(v_session) < 8 or char_length(v_session) > 128 then
    raise exception 'Session id is invalid.';
  end if;

  if not public.reel_is_public(p_reel_id) then
    return;
  end if;

  if exists (
    select 1
    from public.user_events
    where session_id = v_session
      and event_type = 'view'
      and entity_type = 'reel'
      and entity_id = p_reel_id
  ) then
    return;
  end if;

  insert into public.user_events (user_id, session_id, event_type, entity_type, entity_id)
  values ((select auth.uid()), v_session, 'view', 'reel', p_reel_id);

  perform set_config('eme.internal_write', '1', true);
  update public.reels
  set views_count = views_count + 1
  where id = p_reel_id;
  perform set_config('eme.internal_write', '', true);
exception
  when others then
    perform set_config('eme.internal_write', '', true);
    raise;
end;
$$;

comment on function public.record_reel_view(uuid, text) is
  'Counts one public-reel view per session and writes a user_events view row.';

revoke all on function public.record_reel_view(uuid, text) from public;
grant execute on function public.record_reel_view(uuid, text) to anon, authenticated;

create or replace function public.record_reel_share(
  p_reel_id uuid,
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_session text := btrim(coalesce(p_session_id, ''));
begin
  if char_length(v_session) < 8 or char_length(v_session) > 128 then
    raise exception 'Session id is invalid.';
  end if;

  if not public.reel_is_public(p_reel_id) then
    return;
  end if;

  if exists (
    select 1
    from public.user_events
    where session_id = v_session
      and event_type = 'click'
      and entity_type = 'reel'
      and entity_id = p_reel_id
      and metadata @> '{"kind":"share"}'::jsonb
  ) then
    return;
  end if;

  insert into public.user_events (
    user_id, session_id, event_type, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()),
    v_session,
    'click',
    'reel',
    p_reel_id,
    jsonb_build_object('kind', 'share')
  );

  perform set_config('eme.internal_write', '1', true);
  update public.reels
  set shares_count = shares_count + 1
  where id = p_reel_id;
  perform set_config('eme.internal_write', '', true);
exception
  when others then
    perform set_config('eme.internal_write', '', true);
    raise;
end;
$$;

comment on function public.record_reel_share(uuid, text) is
  'Counts one public-reel share per session. Stored as a click event with kind share.';

revoke all on function public.record_reel_share(uuid, text) from public;
grant execute on function public.record_reel_share(uuid, text) to anon, authenticated;

commit;
