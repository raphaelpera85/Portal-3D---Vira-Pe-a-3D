alter table public.digital_assets
  add column preview_path text unique check (preview_path is null or preview_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/preview-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.glb$'),
  add column has_preview boolean generated always as (preview_path is not null) stored;

grant select (has_preview) on public.digital_assets to authenticated;

drop policy "Makers can upload a private digital product file" on storage.objects;
create policy "Makers can upload private digital product files and previews" on storage.objects for insert to authenticated
  with check (bucket_id = 'digital-assets' and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(stl|3mf)$'
      or storage.filename(name) ~* '^preview-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.glb$')
    and exists (select 1 from public.stores s join public.marketplace_products p on p.store_id = s.id
      join public.user_roles r on r.user_id = s.owner_user_id
      where s.id::text = (storage.foldername(name))[1] and s.owner_user_id = (select auth.uid())
        and p.id::text = (storage.foldername(name))[2] and p.created_by = (select auth.uid())
        and p.listing_type = 'digital' and p.catalog_status = 'draft' and r.role = 'maker'::public.app_role));

drop function public.register_digital_asset(uuid, text, text, integer, numeric);
create function public.register_digital_asset(p_product_id uuid, p_object_path text, p_file_name text,
  p_file_bytes integer, p_commercial_price_brl numeric default null, p_preview_path text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  product_row public.marketplace_products%rowtype;
begin
  if actor_id is null or p_product_id is null or p_object_path is null or p_file_name is null
    or p_file_bytes is null or p_file_bytes not between 1 and 52428800
    or char_length(p_file_name) not between 1 and 200 or p_file_name ~ '[/[:cntrl:]]'
    or lower(p_file_name) !~ '\.(stl|3mf)$'
    or right(lower(p_file_name), 4) <> right(lower(p_object_path), 4)
    or (p_commercial_price_brl is not null and (p_commercial_price_brl <= 0 or p_commercial_price_brl > 1000000))
    or not exists (select 1 from public.user_roles r where r.user_id = actor_id and r.role = 'maker'::public.app_role) then
    raise exception using errcode = '22023', message = 'Invalid digital asset';
  end if;
  select p.* into product_row from public.marketplace_products p join public.stores s on s.id = p.store_id
    where p.id = p_product_id and p.created_by = actor_id and p.listing_type = 'digital'
      and p.fulfillment_mode = 'digital' and p.price_mode = 'fixed' and p.catalog_status = 'draft'
      and p.price_brl is not null and s.owner_user_id = actor_id and s.status = 'published'
    for update of p;
  if not found or p_object_path !~ ('^' || product_row.store_id::text || '/' || product_row.id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(stl|3mf)$')
    or not exists (select 1 from storage.objects o where o.bucket_id = 'digital-assets' and o.name = p_object_path
      and coalesce(o.metadata->>'size', '') ~ '^[0-9]+$' and (o.metadata->>'size')::bigint = p_file_bytes)
    or (p_preview_path is not null and (p_preview_path !~ ('^' || product_row.store_id::text || '/' || product_row.id::text
      || '/preview-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.glb$')
      or not exists (select 1 from storage.objects o where o.bucket_id = 'digital-assets' and o.name = p_preview_path
        and coalesce(o.metadata->>'size', '') ~ '^[0-9]+$' and (o.metadata->>'size')::bigint between 1 and 20971520))) then
    raise exception using errcode = '22023', message = 'Uploaded digital files do not match the draft';
  end if;
  insert into public.digital_assets (product_id, store_id, object_path, preview_path, file_name, file_bytes, personal_price_brl, commercial_price_brl)
    values (product_row.id, product_row.store_id, p_object_path, p_preview_path, p_file_name, p_file_bytes, product_row.price_brl, p_commercial_price_brl)
    on conflict (product_id) do update set object_path = excluded.object_path, file_name = excluded.file_name,
      file_bytes = excluded.file_bytes, personal_price_brl = excluded.personal_price_brl,
      commercial_price_brl = excluded.commercial_price_brl, preview_path = coalesce(excluded.preview_path, public.digital_assets.preview_path), updated_at = now();
end;
$$;

create or replace function public.guard_digital_product_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.listing_type = 'digital' and new.catalog_status = 'published' and not exists (
    select 1 from public.digital_assets d where d.product_id = new.id and d.store_id = new.store_id
      and d.personal_price_brl = new.price_brl and d.preview_path is not null
  ) then
    raise exception using errcode = '23514', message = 'Digital product requires a verified private file, preview and personal license price';
  end if;
  return new;
end;
$$;

revoke all on function public.register_digital_asset(uuid, text, text, integer, numeric, text) from public, anon;
grant execute on function public.register_digital_asset(uuid, text, text, integer, numeric, text) to authenticated;
