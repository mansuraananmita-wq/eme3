-- Comment rows were rolled back when the counter update raised anything
-- other than sqlstate 27000, including "Reel counters are maintained by the database".
-- The comment itself should stay. The count is best-effort.

create or replace function public.sync_reel_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  targets uuid[] := '{}';
begin
  if tg_op = 'DELETE' then
    targets := array[old.reel_id];
  elsif tg_op = 'UPDATE' and old.reel_id is distinct from new.reel_id then
    targets := array[old.reel_id, new.reel_id];
  else
    targets := array[new.reel_id];
  end if;

  foreach target in array targets loop
    begin
      perform public.eme_mark_internal_write();
      update public.reels as reel
      set comments_count = (
        select count(*)::integer
        from public.reel_comments as comment_row
        where comment_row.reel_id = target
      )
      where reel.id = target;
      perform set_config('eme.internal_write', '', true);
    exception
      when others then
        perform set_config('eme.internal_write', '', true);
    end;
  end loop;

  return coalesce(new, old);
end;
$$;
