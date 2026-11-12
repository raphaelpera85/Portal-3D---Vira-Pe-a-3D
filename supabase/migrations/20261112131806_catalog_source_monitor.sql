create table public.catalog_versions (
  id uuid primary key default gen_random_uuid(),
  catalog_type text not null check (catalog_type in ('printer', 'material', 'nozzle')),
  record_id uuid not null,
  version_number integer not null check (version_number > 0),
  record_snapshot jsonb not null check (jsonb_typeof(record_snapshot) = 'object'),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null,
  unique (catalog_type, record_id, version_number)
);

create table public.catalog_source_watch_state (
  catalog_type text not null check (catalog_type in ('printer', 'material', 'nozzle')),
  record_id uuid not null,
  record_label text not null,
  source_url text not null check (source_url like 'https://%'),
  last_checked_at timestamptz not null,
  last_http_status integer,
  etag text,
  last_modified text,
  watch_state text not null check (watch_state in ('current', 'unavailable', 'moved', 'changed', 'uncheckable', 'failed')),
  check_detail text,
  primary key (catalog_type, record_id)
);

create table public.catalog_update_history (
  id uuid primary key default gen_random_uuid(),
  catalog_type text not null check (catalog_type in ('printer', 'material', 'nozzle')),
  record_id uuid not null,
  record_label text not null,
  source_url text not null check (source_url like 'https://%'),
  event_type text not null check (event_type in ('source_changed', 'source_unavailable', 'source_moved', 'source_check_failed')),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  observed_etag text,
  observed_last_modified text,
  observed_http_status integer,
  checked_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  unique (catalog_type, record_id, event_type, source_fingerprint)
);

create index catalog_update_history_pending on public.catalog_update_history (checked_at desc) where status = 'pending';
create index catalog_versions_record_history on public.catalog_versions (catalog_type, record_id, version_number desc);
create index catalog_source_watch_recent on public.catalog_source_watch_state (last_checked_at desc);

create function public.version_technical_catalog_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog_type text;
  v_record_id uuid;
  v_version_number integer;
begin
  if to_jsonb(old) is distinct from to_jsonb(new) then
    v_catalog_type := case tg_table_name
      when 'printer_models' then 'printer'
      when 'material_catalog' then 'material'
      when 'nozzle_catalog' then 'nozzle'
      else null
    end;
    v_record_id := (to_jsonb(old) ->> 'id')::uuid;
    select coalesce(max(version_number), 0) + 1 into v_version_number
      from public.catalog_versions
      where catalog_type = v_catalog_type and record_id = v_record_id;
    insert into public.catalog_versions (catalog_type, record_id, version_number, record_snapshot, changed_by)
      values (v_catalog_type, v_record_id, v_version_number, to_jsonb(old), auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.version_technical_catalog_record() from public, anon, authenticated;

create trigger printer_models_version_before_update
  before update on public.printer_models
  for each row execute function public.version_technical_catalog_record();
create trigger material_catalog_version_before_update
  before update on public.material_catalog
  for each row execute function public.version_technical_catalog_record();
create trigger nozzle_catalog_version_before_update
  before update on public.nozzle_catalog
  for each row execute function public.version_technical_catalog_record();

alter table public.catalog_versions enable row level security;
alter table public.catalog_source_watch_state enable row level security;
alter table public.catalog_update_history enable row level security;

revoke all on public.catalog_versions, public.catalog_source_watch_state, public.catalog_update_history from anon, authenticated;
grant select on public.catalog_versions to authenticated;
grant select, update on public.catalog_source_watch_state to authenticated;
grant select, update on public.catalog_update_history to authenticated;
grant select, insert, update on public.catalog_versions, public.catalog_source_watch_state, public.catalog_update_history to service_role;

create policy "Catalog admins read catalog versions"
  on public.catalog_versions for select to authenticated
  using ((select public.is_catalog_admin()));
create policy "Catalog admins read and update source watch state"
  on public.catalog_source_watch_state for select to authenticated
  using ((select public.is_catalog_admin()));
create policy "Catalog admins update source watch state"
  on public.catalog_source_watch_state for update to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));
create policy "Catalog admins read catalog update history"
  on public.catalog_update_history for select to authenticated
  using ((select public.is_catalog_admin()));
create policy "Catalog admins review catalog update history"
  on public.catalog_update_history for update to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));
