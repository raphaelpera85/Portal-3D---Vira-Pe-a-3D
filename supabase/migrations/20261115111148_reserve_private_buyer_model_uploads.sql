create table public.buyer_model_upload_reservations (
  buyer_id uuid not null references auth.users (id) on delete cascade,
  bundle_id uuid not null,
  model_name text not null,
  total_bytes integer not null check (total_bytes between 1 and 20971520),
  files jsonb not null check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 1 and 10),
  status text not null default 'active' check (status in ('active', 'abandoned', 'completed')),
  created_at timestamptz not null default now(),
  cleaned_at timestamptz,
  primary key (buyer_id, bundle_id)
);
create index buyer_model_upload_reservations_recent on public.buyer_model_upload_reservations (buyer_id, created_at desc);
alter table public.buyer_model_upload_reservations enable row level security;
revoke all on public.buyer_model_upload_reservations from public, anon, authenticated;
grant all on public.buyer_model_upload_reservations to service_role;

drop policy "Buyers can upload model files to their own folder" on storage.objects;

create function public.reserve_buyer_model_upload(p_bundle_id uuid, p_model_name text, p_total_bytes integer, p_files jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  buyer_key uuid := (select auth.uid());
  file_count integer;
  total_size bigint;
  model_count integer;
  used_count integer;
  existing public.buyer_model_upload_reservations%rowtype;
begin
  if buyer_key is null or p_bundle_id is null or p_model_name is null or p_files is null
    or p_total_bytes is null or p_total_bytes not between 1 and 20971520
    or not exists (select 1 from public.user_roles r where r.user_id = buyer_key and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(buyer_key::text, 0));
  if jsonb_typeof(p_files) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid model file manifest';
  end if;
  if jsonb_array_length(p_files) not between 1 and 10 then
    raise exception using errcode = '22023', message = 'Invalid model file manifest';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_files) f
    where coalesce(f->>'name', '') = '' or char_length(f->>'name') > 200
      or (f->>'name') ~ '[/[:cntrl:]]'
      or coalesce(f->>'storage_name', '') !~ '^[A-Za-z0-9_. -]{1,200}$'
      or lower(f->>'name') !~ '\.(stl|obj|3mf|glb|gltf|mtl|bin|png|jpg|jpeg|webp)$'
      or lower(f->>'storage_name') !~ '\.(stl|obj|3mf|glb|gltf|mtl|bin|png|jpg|jpeg|webp)$'
      or lower(substring(f->>'name' from '\.([^.]+)$')) <> lower(substring(f->>'storage_name' from '\.([^.]+)$'))
      or coalesce(f->>'size', '') !~ '^[1-9][0-9]{0,7}$'
  ) then raise exception using errcode = '22023', message = 'Invalid model file manifest'; end if;

  select count(*), coalesce(sum((f->>'size')::bigint), 0), count(*) filter (where lower(f->>'storage_name') ~ '\.(stl|obj|3mf|glb|gltf)$')
    into file_count, total_size, model_count from jsonb_array_elements(p_files) f;
  if file_count not between 1 and 10 or total_size <> p_total_bytes or total_size > 20971520 or model_count <> 1
    or (select count(distinct lower(f->>'storage_name')) from jsonb_array_elements(p_files) f) <> file_count
    or not exists (select 1 from jsonb_array_elements(p_files) f where f->>'name' = p_model_name and lower(f->>'storage_name') ~ '\.(stl|obj|3mf|glb|gltf)$') then
    raise exception using errcode = '22023', message = 'Invalid model upload';
  end if;

  select * into existing from public.buyer_model_upload_reservations
    where buyer_id = buyer_key and bundle_id = p_bundle_id for update;
  if found then
    if existing.status = 'active' and existing.cleaned_at is null and existing.model_name = p_model_name
      and existing.total_bytes = p_total_bytes and existing.files = p_files then return; end if;
    raise exception using errcode = '22023', message = 'Model upload reservation unavailable';
  end if;

  select
    (select count(*) from public.buyer_model_upload_reservations r where r.buyer_id = buyer_key and r.created_at >= now() - interval '24 hours')
    + (select count(*) from public.buyer_model_uploads u where u.buyer_id = buyer_key and u.created_at >= now() - interval '24 hours'
       and not exists (select 1 from public.buyer_model_upload_reservations r where r.buyer_id = u.buyer_id and r.bundle_id = u.bundle_id))
    into used_count;
  if used_count >= 5 then raise exception using errcode = '22023', message = 'Buyer model upload limit reached'; end if;

  insert into public.buyer_model_upload_reservations (buyer_id, bundle_id, model_name, total_bytes, files)
    values (buyer_key, p_bundle_id, p_model_name, p_total_bytes, p_files);
end;
$$;

create function public.release_buyer_model_upload_reservation(p_bundle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role
  ) then raise exception using errcode = '42501', message = 'Buyer account required'; end if;
  update public.buyer_model_upload_reservations set status = 'abandoned'
    where buyer_id = (select auth.uid()) and bundle_id = p_bundle_id and status = 'active';
end;
$$;

create or replace function public.register_buyer_model_upload(p_bundle_id uuid, p_model_name text, p_total_bytes integer, p_files jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  buyer_key uuid := (select auth.uid());
  reservation public.buyer_model_upload_reservations%rowtype;
  upload_id uuid;
begin
  if buyer_key is null or not exists (
    select 1 from public.user_roles r where r.user_id = buyer_key and r.role = 'buyer'::public.app_role
  ) then raise exception using errcode = '42501', message = 'Buyer account required'; end if;
  if p_bundle_id is null or p_model_name is null or p_total_bytes is null or p_files is null then
    raise exception using errcode = '22023', message = 'Invalid model upload';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(buyer_key::text, 0));

  select id into upload_id from public.buyer_model_uploads
    where buyer_id = buyer_key and bundle_id = p_bundle_id
      and model_name = p_model_name and total_bytes = p_total_bytes and files = p_files;
  if upload_id is not null then return upload_id; end if;

  select * into reservation from public.buyer_model_upload_reservations
    where buyer_id = buyer_key and bundle_id = p_bundle_id and status = 'active' and cleaned_at is null for update;
  if not found or reservation.model_name <> p_model_name or reservation.total_bytes <> p_total_bytes or reservation.files <> p_files then
    raise exception using errcode = '22023', message = 'Model upload reservation unavailable';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_files) f
    where not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'buyer-models'
        and o.name = buyer_key::text || '/' || p_bundle_id::text || '/' || (f->>'storage_name')
        and coalesce((o.metadata->>'size')::bigint, -1) = (f->>'size')::bigint
    )
  ) then raise exception using errcode = '22023', message = 'Uploaded model files are incomplete'; end if;

  insert into public.buyer_model_uploads (buyer_id, bundle_id, model_name, total_bytes, files)
    values (buyer_key, p_bundle_id, p_model_name, p_total_bytes, p_files)
    on conflict (buyer_id, bundle_id) do nothing returning id into upload_id;
  if upload_id is null then
    select id into upload_id from public.buyer_model_uploads where buyer_id = buyer_key and bundle_id = p_bundle_id
      and model_name = p_model_name and total_bytes = p_total_bytes and files = p_files;
  end if;
  if upload_id is null then raise exception using errcode = '22023', message = 'Model upload bundle conflict'; end if;
  update public.buyer_model_upload_reservations set status = 'completed' where buyer_id = buyer_key and bundle_id = p_bundle_id;
  return upload_id;
end;
$$;

revoke all on function public.reserve_buyer_model_upload(uuid, text, integer, jsonb),
  public.release_buyer_model_upload_reservation(uuid) from public, anon;
grant execute on function public.reserve_buyer_model_upload(uuid, text, integer, jsonb),
  public.release_buyer_model_upload_reservation(uuid) to authenticated;
