alter table public.catalog_source_watch_state
  add column content_sha256 text
    check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$');

alter table public.catalog_update_history
  add column observed_content_sha256 text
    check (observed_content_sha256 is null or observed_content_sha256 ~ '^[a-f0-9]{64}$');
