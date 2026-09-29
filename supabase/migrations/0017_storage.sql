-- 0017_storage.sql
-- Run after 0016.
-- Path convention: {user_id}/{filename}
-- The first folder must be auth.uid()::text. Example:
--   avatars / 6f1c.../avatar.webp
--   product-images / 6f1c.../sku-front.webp
-- These buckets are public, so anyone with the URL can fetch the file.
-- Policies below control listing and writes through the Storage API.
-- Do not put private documents in these buckets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'reel-videos',
    'reel-videos',
    true,
    52428800,
    array['video/mp4', 'video/webm', 'video/quicktime']
  ),
  (
    'reel-thumbnails',
    'reel-thumbnails',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'shop-media',
    'shop-media',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'live-thumbnails',
    'live-thumbnails',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  name = excluded.name;

create or replace function public.storage_path_is_own(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  folder text;
begin
  if auth.uid() is null or object_name is null then
    return false;
  end if;

  folder := (storage.foldername(object_name))[1];
  return folder is not null and folder = auth.uid()::text;
end;
$$;

comment on function public.storage_path_is_own(text) is
  'True when the first folder of a storage object name equals auth.uid(). Path format is {user_id}/{filename}.';

revoke all on function public.storage_path_is_own(text) from public;
grant execute on function public.storage_path_is_own(text) to anon, authenticated;

create or replace function public.storage_vendor_bucket(bucket text)
returns boolean
language sql
immutable
as $$
  select bucket in (
    'product-images',
    'reel-videos',
    'reel-thumbnails',
    'shop-media',
    'live-thumbnails'
  );
$$;

comment on function public.storage_vendor_bucket(text) is
  'Buckets that require an approved shop. avatars is not in this list.';

revoke all on function public.storage_vendor_bucket(text) from public;
grant execute on function public.storage_vendor_bucket(text) to anon, authenticated;

-- postgres can create and drop policies here, but not alter the table.
-- A privilege error is a notice so this file can be pasted again.
do $$
begin
  drop policy if exists eme_storage_public_read on storage.objects;
  create policy eme_storage_public_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id in (
      'product-images',
      'reel-videos',
      'reel-thumbnails',
      'shop-media',
      'avatars',
      'live-thumbnails'
    )
  );
exception
  when insufficient_privilege then
    raise notice 'Skipped policy eme_storage_public_read: %', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists eme_storage_insert on storage.objects;
  create policy eme_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in (
      'product-images',
      'reel-videos',
      'reel-thumbnails',
      'shop-media',
      'avatars',
      'live-thumbnails'
    )
    and public.storage_path_is_own(name)
    and (
      bucket_id = 'avatars'
      or (
        public.storage_vendor_bucket(bucket_id)
        and public.is_approved_vendor()
      )
    )
  );
exception
  when insufficient_privilege then
    raise notice 'Skipped policy eme_storage_insert: %', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists eme_storage_update on storage.objects;
  create policy eme_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id in (
      'product-images',
      'reel-videos',
      'reel-thumbnails',
      'shop-media',
      'avatars',
      'live-thumbnails'
    )
    and public.storage_path_is_own(name)
    and (
      bucket_id = 'avatars'
      or (
        public.storage_vendor_bucket(bucket_id)
        and public.is_approved_vendor()
      )
    )
  )
  with check (
    bucket_id in (
      'product-images',
      'reel-videos',
      'reel-thumbnails',
      'shop-media',
      'avatars',
      'live-thumbnails'
    )
    and public.storage_path_is_own(name)
    and (
      bucket_id = 'avatars'
      or (
        public.storage_vendor_bucket(bucket_id)
        and public.is_approved_vendor()
      )
    )
  );
exception
  when insufficient_privilege then
    raise notice 'Skipped policy eme_storage_update: %', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists eme_storage_delete on storage.objects;
  create policy eme_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in (
      'product-images',
      'reel-videos',
      'reel-thumbnails',
      'shop-media',
      'avatars',
      'live-thumbnails'
    )
    and (
      public.is_admin()
      or (
        public.storage_path_is_own(name)
        and (
          bucket_id = 'avatars'
          or (
            public.storage_vendor_bucket(bucket_id)
            and public.is_approved_vendor()
          )
        )
      )
    )
  );
exception
  when insufficient_privilege then
    raise notice 'Skipped policy eme_storage_delete: %', sqlerrm;
end;
$$;
