insert into storage.buckets (id, name, public, file_size_limit)
values ('digital-assets', 'digital-assets', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create table public.digital_assets (
  product_id uuid primary key references public.marketplace_products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete restrict,
  object_path text not null unique check (object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{8}-[0-9a-f-]{4}-[1-8][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}\.(stl|3mf)$'),
  file_name text not null check (char_length(file_name) between 1 and 200 and file_name !~ '[/[:cntrl:]]' and lower(file_name) ~ '\.(stl|3mf)$'),
  file_bytes integer not null check (file_bytes between 1 and 52428800),
  personal_price_brl numeric(12, 2) not null check (personal_price_brl > 0),
  commercial_price_brl numeric(12, 2) check (commercial_price_brl is null or commercial_price_brl > 0),
  updated_at timestamptz not null default now(),
  check (personal_price_brl <= 1000000 and (commercial_price_brl is null or commercial_price_brl <= 1000000))
);

create index digital_assets_store_recent on public.digital_assets (store_id, updated_at desc);
alter table public.digital_assets enable row level security;
revoke all on public.digital_assets from anon, authenticated;
grant select (product_id, personal_price_brl, commercial_price_brl, updated_at) on public.digital_assets to anon;
grant select (product_id, store_id, file_name, personal_price_brl, commercial_price_brl, updated_at) on public.digital_assets to authenticated;

create policy "Public can read licenses for published digital assets" on public.digital_assets for select to anon, authenticated
  using (exists (select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
    where p.id = digital_assets.product_id and p.store_id = digital_assets.store_id and p.listing_type = 'digital' and p.catalog_status = 'published' and s.status = 'published'));
create policy "Store owners can read their digital assets" on public.digital_assets for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid())));
create policy "Admins can read digital assets" on public.digital_assets for select to authenticated
  using ((select public.is_catalog_admin()));

create policy "Makers can upload a private digital product file" on storage.objects for insert to authenticated
  with check (bucket_id = 'digital-assets' and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(stl|3mf)$'
    and exists (select 1 from public.stores s join public.marketplace_products p on p.store_id = s.id
      join public.user_roles r on r.user_id = s.owner_user_id
      where s.id::text = (storage.foldername(name))[1] and s.owner_user_id = (select auth.uid())
        and p.id::text = (storage.foldername(name))[2] and p.created_by = (select auth.uid())
        and p.listing_type = 'digital' and p.catalog_status = 'draft' and r.role = 'maker'::public.app_role));
create policy "Makers can read their private digital product file" on storage.objects for select to authenticated
  using (bucket_id = 'digital-assets' and exists (select 1 from public.stores s
    where s.id::text = (storage.foldername(name))[1] and s.owner_user_id = (select auth.uid())));
create policy "Makers can replace their private digital product file" on storage.objects for update to authenticated
  using (bucket_id = 'digital-assets' and exists (select 1 from public.stores s join public.marketplace_products p on p.store_id = s.id
    where s.id::text = (storage.foldername(name))[1] and s.owner_user_id = (select auth.uid())
      and p.id::text = (storage.foldername(name))[2] and p.created_by = (select auth.uid()) and p.listing_type = 'digital' and p.catalog_status = 'draft'))
  with check (bucket_id = 'digital-assets' and exists (select 1 from public.stores s join public.marketplace_products p on p.store_id = s.id
    where s.id::text = (storage.foldername(name))[1] and s.owner_user_id = (select auth.uid())
      and p.id::text = (storage.foldername(name))[2] and p.created_by = (select auth.uid()) and p.listing_type = 'digital' and p.catalog_status = 'draft'));
create policy "Makers can remove their private digital product file" on storage.objects for delete to authenticated
  using (bucket_id = 'digital-assets' and exists (select 1 from public.stores s join public.marketplace_products p on p.store_id = s.id
    where s.id::text = (storage.foldername(name))[1] and s.owner_user_id = (select auth.uid())
      and p.id::text = (storage.foldername(name))[2] and p.created_by = (select auth.uid()) and p.listing_type = 'digital' and p.catalog_status = 'draft'));

alter table public.marketplace_products add constraint digital_products_require_digital_fulfillment
  check (listing_type <> 'digital' or (fulfillment_mode = 'digital' and price_mode = 'fixed' and stock_quantity is null and preparation_days is null));

create function public.register_digital_asset(p_product_id uuid, p_object_path text, p_file_name text,
  p_file_bytes integer, p_commercial_price_brl numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  product_row public.marketplace_products%rowtype;
begin
  if actor_id is null or p_product_id is null or p_object_path is null or p_file_name is null
    or p_file_bytes is null or p_file_bytes not between 1 and 52428800
    or char_length(p_file_name) not between 1 and 200 or p_file_name ~ '[/[:cntrl:]]'
    or lower(p_file_name) !~ '\.(stl|3mf)$'
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
      and coalesce(o.metadata->>'size', '') ~ '^[0-9]+$' and (o.metadata->>'size')::bigint = p_file_bytes) then
    raise exception using errcode = '22023', message = 'Uploaded digital asset does not match the draft';
  end if;
  insert into public.digital_assets (product_id, store_id, object_path, file_name, file_bytes, personal_price_brl, commercial_price_brl)
    values (product_row.id, product_row.store_id, p_object_path, p_file_name, p_file_bytes, product_row.price_brl, p_commercial_price_brl)
    on conflict (product_id) do update set object_path = excluded.object_path, file_name = excluded.file_name,
      file_bytes = excluded.file_bytes, personal_price_brl = excluded.personal_price_brl,
      commercial_price_brl = excluded.commercial_price_brl, updated_at = now();
end;
$$;

create function public.guard_digital_product_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.listing_type = 'digital' and new.catalog_status = 'published' and not exists (
    select 1 from public.digital_assets d where d.product_id = new.id and d.store_id = new.store_id
      and d.personal_price_brl = new.price_brl
  ) then
    raise exception using errcode = '23514', message = 'Digital product requires a verified private file and personal license price';
  end if;
  return new;
end;
$$;
create trigger guard_digital_product_publication_before_update before update of catalog_status on public.marketplace_products
  for each row when (new.catalog_status = 'published') execute function public.guard_digital_product_publication();

revoke all on function public.register_digital_asset(uuid, text, text, integer, numeric), public.guard_digital_product_publication() from public, anon;
grant execute on function public.register_digital_asset(uuid, text, text, integer, numeric) to authenticated;
