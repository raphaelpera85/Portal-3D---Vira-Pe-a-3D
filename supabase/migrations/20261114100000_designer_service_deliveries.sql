insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('designer-service-deliveries', 'designer-service-deliveries', false, 52428800, array['application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.designer_service_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.designer_service_requests (id) on delete cascade,
  delivered_by uuid not null references auth.users (id),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create table public.designer_service_delivery_files (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.designer_service_deliveries (id) on delete cascade,
  request_id uuid not null references public.designer_service_requests (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_size bigint not null check (file_size between 1 and 52428800),
  extension text not null check (extension in ('stl', '3mf', 'obj', 'mtl', 'gltf', 'glb', 'step', 'stp', 'blend', 'zip')),
  created_at timestamptz not null default now(),
  check (storage_path ~* ('^' || request_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.' || extension || '$'))
);

create table public.designer_service_delivery_uploads (
  storage_path text primary key,
  request_id uuid not null references public.designer_service_requests (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_size bigint not null check (file_size between 1 and 52428800),
  extension text not null check (extension in ('stl', '3mf', 'obj', 'mtl', 'gltf', 'glb', 'step', 'stp', 'blend', 'zip')),
  created_at timestamptz not null default now(),
  check (storage_path ~* ('^' || request_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.' || extension || '$'))
);

create index designer_service_delivery_files_request on public.designer_service_delivery_files (request_id);
alter table public.designer_service_deliveries enable row level security;
alter table public.designer_service_delivery_files enable row level security;
alter table public.designer_service_delivery_uploads enable row level security;
revoke all on public.designer_service_deliveries, public.designer_service_delivery_files,
  public.designer_service_delivery_uploads from anon, authenticated;
grant select on public.designer_service_deliveries, public.designer_service_delivery_files to authenticated;

create policy "Participants can read designer service deliveries" on public.designer_service_deliveries
for select to authenticated using (
  exists (select 1 from public.designer_service_requests q
    left join public.designer_profiles d on d.id = q.designer_profile_id
    where q.id = request_id and (q.buyer_id = (select auth.uid()) or d.user_id = (select auth.uid())))
);
create policy "Participants can read designer service delivery files" on public.designer_service_delivery_files
for select to authenticated using (
  exists (select 1 from public.designer_service_requests q
    left join public.designer_profiles d on d.id = q.designer_profile_id
    where q.id = request_id and (q.buyer_id = (select auth.uid()) or d.user_id = (select auth.uid())))
);

create policy "Participants can download registered designer deliverables" on storage.objects
for select to authenticated using (
  bucket_id = 'designer-service-deliveries' and exists (
    select 1 from public.designer_service_delivery_files f
    join public.designer_service_requests q on q.id = f.request_id
    left join public.designer_profiles d on d.id = q.designer_profile_id
    where f.storage_path = name and (q.buyer_id = (select auth.uid()) or d.user_id = (select auth.uid()))
  )
);
create policy "Assigned designers can remove unregistered delivery uploads" on storage.objects
for delete to authenticated using (
  bucket_id = 'designer-service-deliveries'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (select 1 from public.designer_service_requests q
    join public.designer_profiles d on d.id = q.designer_profile_id
    where q.id::text = split_part(name, '/', 1) and d.user_id = (select auth.uid()) and q.status = 'in_progress')
  and not exists (select 1 from public.designer_service_delivery_files f where f.storage_path = name)
);

create function public.submit_designer_service_delivery(p_request_id uuid, p_notes text, p_files jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.designer_service_requests%rowtype;
  file_row jsonb;
  total_bytes bigint := 0;
  file_count integer;
  storage_size bigint;
  delivery_id uuid;
begin
  if actor_id is null or p_request_id is null or p_files is null or jsonb_typeof(p_files) <> 'array'
    or jsonb_array_length(p_files) not between 1 and 10 or coalesce(char_length(p_notes), 0) > 2000
    or not exists (select 1 from public.user_roles r where r.user_id = actor_id and r.role = 'designer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Invalid designer service delivery';
  end if;
  select q.* into request_row from public.designer_service_requests q
    join public.designer_profiles d on d.id = q.designer_profile_id
    where q.id = p_request_id and d.user_id = actor_id and q.status = 'in_progress' for update of q;
  if not found then raise exception using errcode = '42501', message = 'Designer service request unavailable'; end if;
  if not exists (select 1 from public.seller_order_payments p where p.designer_service_request_id = p_request_id and p.status = 'paid')
    or exists (select 1 from public.designer_service_deliveries x where x.request_id = p_request_id) then
    raise exception using errcode = '22023', message = 'Designer service payment or delivery state is invalid';
  end if;

  file_count := jsonb_array_length(p_files);
  for file_row in select value from jsonb_array_elements(p_files) loop
    if jsonb_typeof(file_row) <> 'object' or coalesce(file_row->>'path', '') !~* ('^' || p_request_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(stl|3mf|obj|mtl|gltf|glb|step|stp|blend|zip)$')
      or char_length(coalesce(file_row->>'name', '')) not between 1 and 200
      or (file_row->>'name') ~ '[[:cntrl:]]' or position('/' in file_row->>'name') > 0 or position(chr(92) in file_row->>'name') > 0
      or coalesce(file_row->>'extension', '') not in ('stl', '3mf', 'obj', 'mtl', 'gltf', 'glb', 'step', 'stp', 'blend', 'zip')
      or coalesce(file_row->>'size', '') !~ '^[1-9][0-9]{0,7}$' then
      raise exception using errcode = '22023', message = 'Invalid designer service delivery file';
    end if;
    if lower(split_part(file_row->>'name', '.', -1)) <> file_row->>'extension'
      or (file_row->>'path') !~* ('\.' || (file_row->>'extension') || '$') then
      raise exception using errcode = '22023', message = 'Designer service delivery extension mismatch';
    end if;
    total_bytes := total_bytes + (file_row->>'size')::bigint;
    if (file_row->>'size')::bigint > 52428800 then
      raise exception using errcode = '22023', message = 'Designer service delivery file is too large';
    end if;
    select (o.metadata->>'size')::bigint into storage_size from storage.objects o
      where o.bucket_id = 'designer-service-deliveries' and o.name = file_row->>'path';
    if storage_size is distinct from (file_row->>'size')::bigint
      or not exists (select 1 from public.designer_service_delivery_uploads u
        where u.storage_path = file_row->>'path' and u.request_id = p_request_id and u.created_by = actor_id
          and u.file_name = file_row->>'name' and u.file_size = (file_row->>'size')::bigint
          and u.extension = file_row->>'extension') then
      raise exception using errcode = '22023', message = 'Designer service delivery upload is missing';
    end if;
  end loop;
  if total_bytes > 104857600 or (select count(distinct value->>'path') from jsonb_array_elements(p_files)) <> file_count then
    raise exception using errcode = '22023', message = 'Designer service delivery exceeds its limits';
  end if;

  insert into public.designer_service_deliveries (request_id, delivered_by, notes)
    values (p_request_id, actor_id, coalesce(p_notes, '')) returning id into delivery_id;
  insert into public.designer_service_delivery_files (delivery_id, request_id, storage_path, file_name, file_size, extension)
    select delivery_id, p_request_id, value->>'path', value->>'name', (value->>'size')::bigint, value->>'extension'
    from jsonb_array_elements(p_files);
  delete from public.designer_service_delivery_uploads where request_id = p_request_id and created_by = actor_id;
  update public.designer_service_requests set status = 'completed', work_completed_at = now(), updated_at = now()
    where id = p_request_id;
end;
$$;

create or replace function public.advance_designer_service_work(p_request_id uuid, p_next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.designer_service_requests%rowtype;
  payment_status text;
begin
  if actor_id is null or p_request_id is null or p_next_status <> 'in_progress'
    or not exists (select 1 from public.user_roles r where r.user_id = actor_id and r.role = 'designer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Invalid designer service transition';
  end if;
  select q.* into request_row from public.designer_service_requests q
    join public.designer_profiles d on d.id = q.designer_profile_id
    where q.id = p_request_id and d.user_id = actor_id for update of q;
  if not found or request_row.status <> 'paid' then
    raise exception using errcode = '22023', message = 'Designer service transition is invalid';
  end if;
  select p.status into payment_status from public.seller_order_payments p
    where p.designer_service_request_id = p_request_id order by p.created_at desc limit 1 for update;
  if payment_status is distinct from 'paid' then
    raise exception using errcode = '22023', message = 'Designer service payment is not settled';
  end if;
  update public.designer_service_requests set status = 'in_progress', work_started_at = now(), updated_at = now()
    where id = p_request_id;
end;
$$;

revoke all on function public.submit_designer_service_delivery(uuid, text, jsonb),
  public.advance_designer_service_work(uuid, text) from public, anon;
grant execute on function public.submit_designer_service_delivery(uuid, text, jsonb),
  public.advance_designer_service_work(uuid, text) to authenticated;
