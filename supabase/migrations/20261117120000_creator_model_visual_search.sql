alter table public.creator_model_submissions add column preview_hash text;

alter table public.creator_model_submissions
  add constraint creator_model_preview_hash_check check (
    preview_hash is null or (preview_path is not null and preview_hash ~ '^[0-9a-f]{16}$')
  );

grant select (preview_hash) on public.creator_model_submissions to anon, authenticated;
