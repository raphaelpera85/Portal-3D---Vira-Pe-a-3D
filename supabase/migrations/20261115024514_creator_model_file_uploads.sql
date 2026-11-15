alter table public.creator_model_submissions alter column asset_path drop not null;
alter table public.creator_model_submissions add column storage_path text;
alter table public.creator_model_submissions add column file_name text;
alter table public.creator_model_submissions add column file_size_bytes bigint;

alter table public.creator_model_submissions drop constraint creator_model_submissions_asset_path_check;
alter table public.creator_model_submissions add constraint creator_model_submissions_asset_path_check
  check (asset_path is null or asset_path ~ '^models/[a-z0-9]+(-[a-z0-9]+)*\.3mf$');
alter table public.creator_model_submissions drop constraint creator_model_submissions_review_status_check;
alter table public.creator_model_submissions add constraint creator_model_submissions_review_status_check
  check (review_status in ('uploading', 'pending', 'published', 'rejected', 'archived'));
alter table public.creator_model_submissions drop constraint creator_model_submissions_check;
alter table public.creator_model_submissions add constraint creator_model_submissions_review_state_check
  check (((review_status in ('uploading', 'pending')) and reviewed_by is null and reviewed_at is null)
    or (review_status not in ('uploading', 'pending') and reviewed_by is not null and reviewed_at is not null));
alter table public.creator_model_submissions add constraint creator_model_submissions_file_source_check
  check (
    (asset_path is not null and storage_path is null and file_name is null and file_size_bytes is null)
    or (asset_path is null and storage_path = submitted_by::text || '/' || id || '.3mf'
      and file_name is not null and char_length(file_name) between 5 and 200
      and file_name ~* '\.3mf$' and file_name !~ '[\\/[:cntrl:]]'
      and file_size_bytes is not null and file_size_bytes between 1 and 52428800)
  );
create unique index creator_model_storage_path_unique on public.creator_model_submissions (storage_path) where storage_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-model-uploads', 'creator-model-uploads', false, 52428800, array['application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;
