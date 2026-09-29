-- seed_demo_reels_real.sql
-- Idempotent: points every published reel at Storage-hosted demo MP4s / thumbnails
-- uploaded by fetch-demo-reel-videos.mjs (bucket reel-videos + reel-thumbnails under demo/).
-- Does not change captions or product tags. Assigns videos round-robin by created_at.
-- reel_status has no 'archived'; RLS test reel (caption = 'RLS reel') is set to 'removed'.
-- Generated: 2026-09-29T20:16:23.008Z
-- Clips: 12

begin;

with numbered as (
  select
    id,
    (row_number() over (order by created_at asc, id asc) - 1) % 12 as slot
  from public.reels
  where status = 'published'
)
update public.reels as r
set
  video_path = case n.slot
    when 0 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/1.mp4'
    when 1 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/2.mp4'
    when 2 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/3.mp4'
    when 3 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/4.mp4'
    when 4 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/5.mp4'
    when 5 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/6.mp4'
    when 6 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/7.mp4'
    when 7 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/8.mp4'
    when 8 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/9.mp4'
    when 9 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/10.mp4'
    when 10 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/11.mp4'
    when 11 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-videos/demo/12.mp4'
  end,
  thumbnail_path = case n.slot
    when 0 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/1.jpg'
    when 1 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/2.jpg'
    when 2 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/3.jpg'
    when 3 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/4.jpg'
    when 4 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/5.jpg'
    when 5 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/6.jpg'
    when 6 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/7.jpg'
    when 7 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/8.jpg'
    when 8 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/9.jpg'
    when 9 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/10.jpg'
    when 10 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/11.jpg'
    when 11 then 'https://uqlqgkwaqsikydckydau.supabase.co/storage/v1/object/public/reel-thumbnails/demo/12.jpg'
  end
from numbered as n
where r.id = n.id;

-- Real enum value for soft-remove (no 'archived' in reel_status).
update public.reels
set status = 'removed'
where caption = 'RLS reel'
  and status is distinct from 'removed';

commit;

-- Verification: published reels still missing a video_path
select id, caption, video_path, thumbnail_path, status, created_at
from public.reels
where status = 'published'
  and (video_path is null or btrim(video_path) = '')
order by created_at;
