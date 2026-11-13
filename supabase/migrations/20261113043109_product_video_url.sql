alter table public.marketplace_products
  add column video_url text,
  add constraint marketplace_products_video_url_check check (
    video_url is null
    or (
      length(video_url) <= 1000
      and video_url ~ '^https://'
      and lower(split_part(split_part(video_url, '?', 1), '#', 1)) ~ '\.(mp4|webm)$'
    )
  );
