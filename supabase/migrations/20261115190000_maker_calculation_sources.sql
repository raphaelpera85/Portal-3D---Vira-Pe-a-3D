insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maker-calculation-sources', 'maker-calculation-sources', false, 52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml']
)
on conflict (id) do update set
  name = excluded.name, public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.maker_cost_calculation_attachments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  calculation_id uuid not null references public.maker_cost_calculations (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255 and file_name !~ '[/\\]' and file_name !~ '[[:cntrl:]]'),
  content_type text not null check (content_type in (
    'image/png', 'image/jpeg', 'image/webp', 'model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'
  )),
  size_bytes integer not null check (size_bytes between 1 and 52428800 and (content_type not like 'image/%' or size_bytes <= 2097152)),
  created_at timestamptz not null default now(),
  check (
    (content_type = 'image/png' and storage_path = store_id::text || '/' || calculation_id::text || '/' || id::text || '.png')
    or (content_type = 'image/jpeg' and storage_path = store_id::text || '/' || calculation_id::text || '/' || id::text || '.jpg')
    or (content_type = 'image/webp' and storage_path = store_id::text || '/' || calculation_id::text || '/' || id::text || '.webp')
    or (content_type in ('model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml')
      and storage_path = store_id::text || '/' || calculation_id::text || '/' || id::text || '.3mf')
  )
);

create index maker_calculation_attachments_recent on public.maker_cost_calculation_attachments (calculation_id, created_at);

create function public.enforce_maker_calculation_attachment_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare image_count bigint; image_bytes bigint; model_count bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.calculation_id::text)::bigint);
  select count(*) filter (where a.content_type like 'image/%'),
    coalesce(sum(a.size_bytes) filter (where a.content_type like 'image/%'), 0),
    count(*) filter (where a.content_type in ('model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'))
    into image_count, image_bytes, model_count
    from public.maker_cost_calculation_attachments a where a.calculation_id = new.calculation_id;
  if (new.content_type like 'image/%' and (image_count >= 3 or image_bytes + new.size_bytes > 4194304))
    or (new.content_type in ('model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml') and model_count >= 1) then
    raise exception 'calculation source file limit exceeded';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_maker_calculation_attachment_limit() from public, anon, authenticated;
create trigger enforce_maker_calculation_attachment_limit_before_insert
  before insert on public.maker_cost_calculation_attachments
  for each row execute function public.enforce_maker_calculation_attachment_limit();

alter table public.maker_cost_calculation_attachments enable row level security;
revoke all on public.maker_cost_calculation_attachments from anon, authenticated;
grant select, insert, delete on public.maker_cost_calculation_attachments to authenticated;

create policy "Makers read own calculation source metadata" on public.maker_cost_calculation_attachments
  for select to authenticated using (
    owner_user_id = (select auth.uid())
    and exists (select 1 from public.stores s join public.maker_cost_calculations c on c.store_id = s.id
      where s.id = maker_cost_calculation_attachments.store_id and s.owner_user_id = (select auth.uid())
        and c.id = maker_cost_calculation_attachments.calculation_id)
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Makers attach sources to own calculations" on public.maker_cost_calculation_attachments
  for insert to authenticated with check (
    owner_user_id = (select auth.uid())
    and exists (select 1 from public.stores s join public.maker_cost_calculations c on c.store_id = s.id
      where s.id = maker_cost_calculation_attachments.store_id and s.owner_user_id = (select auth.uid())
        and c.id = maker_cost_calculation_attachments.calculation_id)
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Makers delete own calculation source metadata" on public.maker_cost_calculation_attachments
  for delete to authenticated using (
    owner_user_id = (select auth.uid())
    and exists (select 1 from public.stores s where s.id = maker_cost_calculation_attachments.store_id and s.owner_user_id = (select auth.uid()))
    and not exists (select 1 from storage.objects o where o.bucket_id = 'maker-calculation-sources' and o.name = maker_cost_calculation_attachments.storage_path)
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Makers upload registered calculation source files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'maker-calculation-sources'
    and (metadata->>'size') ~ '^[1-9][0-9]{0,7}$'
    and exists (select 1 from public.maker_cost_calculation_attachments a
      join public.stores s on s.id = a.store_id
      join public.maker_cost_calculations c on c.id = a.calculation_id and c.store_id = a.store_id
      where a.storage_path = name and a.owner_user_id = (select auth.uid()) and s.owner_user_id = (select auth.uid())
        and a.store_id::text = (storage.foldername(name))[1] and a.calculation_id::text = (storage.foldername(name))[2]
        and storage.filename(name) = a.id::text || case a.content_type
          when 'image/png' then '.png' when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp' else '.3mf' end
        and a.size_bytes = (metadata->>'size')::integer and a.content_type = metadata->>'mimetype')
  );

create policy "Makers read own calculation source files" on storage.objects
  for select to authenticated using (
    bucket_id = 'maker-calculation-sources'
    and exists (select 1 from public.maker_cost_calculation_attachments a
      join public.stores s on s.id = a.store_id
      where a.storage_path = name and a.owner_user_id = (select auth.uid()) and s.owner_user_id = (select auth.uid()))
  );

create policy "Makers delete own calculation source files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'maker-calculation-sources'
    and exists (select 1 from public.maker_cost_calculation_attachments a
      join public.stores s on s.id = a.store_id
      where a.storage_path = name and a.owner_user_id = (select auth.uid()) and s.owner_user_id = (select auth.uid()))
  );
