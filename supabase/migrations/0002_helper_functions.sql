-- 0002_helper_functions.sql
-- Reusable updated_at trigger, plus the transaction flag used by counter writers.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger. Stamps updated_at. Attach it to every public table.';

-- Counter writers set this for the current transaction before they UPDATE a count.
-- Guard triggers allow the change only when the flag is present.
create or replace function public.eme_mark_internal_write()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('eme.internal_write', '1', true);
end;
$$;

revoke all on function public.eme_mark_internal_write() from public;
revoke all on function public.eme_mark_internal_write() from anon, authenticated;
