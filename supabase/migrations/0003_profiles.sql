-- 0003_profiles.sql
-- One profile per auth user. Role is always customer at signup.
-- Vendors and admins are promoted later by an admin, never from user metadata.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_len check (
    full_name is null or char_length(btrim(full_name)) between 1 and 120
  ),
  constraint profiles_phone_len check (
    phone is null or char_length(btrim(phone)) between 6 and 20
  )
);

comment on table public.profiles is
  'Application profile for auth.users. role defaults to customer and must not be taken from signup metadata.';

create index profiles_role_idx on public.profiles (role);
create index profiles_created_at_idx on public.profiles (created_at desc);

create trigger set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Role is omitted on purpose. The column default is customer.
  -- Do not read role, or any other privilege, from raw_user_meta_data.
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      ''
    ),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  );

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT on auth.users. Creates a customer profile. Ignores any role in user metadata.';

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
begin
  if tg_op = 'INSERT' then
    -- Signup and any API insert always land as customer.
    -- The SQL editor (postgres / supabase_admin) may repair a row directly.
    if session_user not in ('postgres', 'supabase_admin') then
      new.role := 'customer';
    end if;
    return new;
  end if;

  if new.role is not distinct from old.role then
    return new;
  end if;

  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
  into actor_is_admin;

  if actor_is_admin then
    return new;
  end if;

  raise exception 'Only an admin can change a profile role';
end;
$$;

comment on function public.guard_profile_role() is
  'Blocks privilege escalation. API inserts are forced to customer. Role updates require an existing admin, or the SQL editor.';

revoke all on function public.guard_profile_role() from public;
grant execute on function public.guard_profile_role() to authenticated;

create trigger guard_profile_role
before insert or update of role on public.profiles
for each row
execute function public.guard_profile_role();
