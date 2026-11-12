insert into storage.buckets (id, name, public, file_size_limit)
values ('buyer-models', 'buyer-models', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "Buyers can read their own model files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'buyer-models'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
  );
create policy "Buyers can upload model files to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'buyer-models'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and storage.filename(name) ~* '\.(stl|obj|3mf|glb|gltf|mtl|bin|png|jpg|jpeg|webp)$'
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
  );
create policy "Buyers can remove their own model files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'buyer-models'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
  );

create table public.buyer_model_uploads (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  bundle_id uuid not null,
  model_name text not null check (char_length(model_name) between 1 and 200),
  total_bytes integer not null check (total_bytes between 1 and 20971520),
  files jsonb not null check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 1 and 10),
  created_at timestamptz not null default now(),
  unique (buyer_id, bundle_id)
);
create index buyer_model_uploads_recent on public.buyer_model_uploads (buyer_id, created_at desc);
alter table public.buyer_model_uploads enable row level security;
revoke all on public.buyer_model_uploads from anon, authenticated;
grant select on public.buyer_model_uploads to authenticated;
create policy "Buyers can read their own model upload records"
  on public.buyer_model_uploads for select to authenticated
  using (
    buyer_id = (select auth.uid())
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
  );

create function public.register_buyer_model_upload(p_bundle_id uuid, p_model_name text, p_total_bytes integer, p_files jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer_key uuid := (select auth.uid());
  file_count integer;
  total_size bigint;
  model_count integer;
  invalid_count integer;
  upload_id uuid;
begin
  if buyer_key is null or p_bundle_id is null or p_model_name is null or p_files is null
    or p_total_bytes is null or p_total_bytes not between 1 and 20971520
    or not exists (select 1 from public.user_roles r where r.user_id = buyer_key and r.role = 'buyer'::public.app_role)
  then
    raise exception using errcode = '22023', message = 'Invalid model upload';
  end if;
  if jsonb_typeof(p_files) <> 'array' then raise exception using errcode = '22023', message = 'Invalid model file manifest'; end if;
  if jsonb_array_length(p_files) not between 1 and 10 then raise exception using errcode = '22023', message = 'Invalid model file manifest'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_files) f
    where coalesce(f->>'name', '') = '' or char_length(f->>'name') > 200
      or (f->>'name') ~ '[/[:cntrl:]]'
      or coalesce(f->>'size', '') !~ '^[1-9][0-9]{0,7}$'
      or lower(f->>'name') !~ '\.(stl|obj|3mf|glb|gltf|mtl|bin|png|jpg|jpeg|webp)$'
  ) then raise exception using errcode = '22023', message = 'Invalid model file manifest'; end if;

  select count(*), coalesce(sum((f->>'size')::bigint), 0), count(*) filter (where lower(f->>'name') ~ '\.(stl|obj|3mf|glb|gltf)$')
    into file_count, total_size, model_count from jsonb_array_elements(p_files) f;
  select count(*) into invalid_count from (
    select lower(f->>'name') from jsonb_array_elements(p_files) f group by lower(f->>'name') having count(*) > 1
  ) duplicate_names;
  if file_count not between 1 and 10 or model_count <> 1 or total_size <> p_total_bytes or invalid_count > 0
    or not exists (select 1 from jsonb_array_elements(p_files) f where f->>'name' = p_model_name and lower(f->>'name') ~ '\.(stl|obj|3mf|glb|gltf)$')
    or exists (
      select 1 from jsonb_array_elements(p_files) f
      where not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'buyer-models'
          and o.name = buyer_key::text || '/' || p_bundle_id::text || '/' || (f->>'name')
          and coalesce((o.metadata->>'size')::bigint, -1) = (f->>'size')::bigint
      )
    ) then
    raise exception using errcode = '22023', message = 'Uploaded model files are incomplete';
  end if;

  insert into public.buyer_model_uploads (buyer_id, bundle_id, model_name, total_bytes, files)
    values (buyer_key, p_bundle_id, p_model_name, p_total_bytes, p_files)
    on conflict (buyer_id, bundle_id) do nothing
    returning id into upload_id;
  if upload_id is null then
    select id into upload_id from public.buyer_model_uploads where buyer_id = buyer_key and bundle_id = p_bundle_id;
  end if;
  return upload_id;
end;
$$;

create function public.delete_buyer_model_upload(p_upload_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role
  ) then raise exception using errcode = '42501', message = 'Buyer account required'; end if;
  delete from public.buyer_model_uploads where id = p_upload_id and buyer_id = (select auth.uid());
end;
$$;

revoke all on function public.register_buyer_model_upload(uuid, text, integer, jsonb), public.delete_buyer_model_upload(uuid) from public, anon;
grant execute on function public.register_buyer_model_upload(uuid, text, integer, jsonb), public.delete_buyer_model_upload(uuid) to authenticated;
