alter table public.creator_model_submissions
  add column preview_path text,
  add column preview_size_bytes bigint,
  add column preview_content_type text;

alter table public.creator_model_submissions
  add constraint creator_model_preview_metadata_check check (
    (preview_path is null and preview_size_bytes is null and preview_content_type is null)
    or (
      preview_path is not null and preview_size_bytes is not null and preview_content_type is not null
      and preview_path = submitted_by::text || '/' || id || '-preview.' ||
        case preview_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end
      and preview_size_bytes between 1 and 5242880
      and preview_content_type in ('image/png', 'image/jpeg', 'image/webp')
    )
  );

grant select (preview_path) on public.creator_model_submissions to anon, authenticated;

update storage.buckets
set allowed_mime_types = array['application/octet-stream', 'image/png', 'image/jpeg', 'image/webp']
where id = 'creator-model-uploads';
