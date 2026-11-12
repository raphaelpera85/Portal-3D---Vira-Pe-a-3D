create unique index marketplace_products_id_store on public.marketplace_products (id, store_id);
create unique index maker_printers_id_store on public.maker_printers (id, store_id);

create table public.maker_print_profiles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null,
  profile_name text not null check (char_length(btrim(profile_name)) between 2 and 100),
  profile_type text not null check (profile_type in ('economic', 'fast', 'detailed', 'multicolor', 'custom')),
  sharing_scope text not null default 'private' check (sharing_scope in ('private', 'community', 'official')),
  review_status text not null default 'draft' check (review_status in ('draft', 'pending', 'published', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete restrict,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  maker_printer_id uuid,
  printer_model_id uuid references public.printer_models (id) on delete set null,
  printer_snapshot text not null check (char_length(btrim(printer_snapshot)) between 2 and 120),
  material_id uuid references public.material_catalog (id) on delete set null,
  material_snapshot text not null check (char_length(btrim(material_snapshot)) between 2 and 120),
  nozzle_id uuid references public.nozzle_catalog (id) on delete set null,
  nozzle_snapshot text not null check (char_length(btrim(nozzle_snapshot)) between 2 and 120),
  layer_height_mm numeric(6, 3) check (layer_height_mm is null or (layer_height_mm > 0 and layer_height_mm <= 5)),
  infill_percent numeric(5, 2) check (infill_percent is null or infill_percent between 0 and 100),
  wall_count smallint check (wall_count is null or wall_count between 0 and 100),
  supports boolean not null default false,
  orientation text not null default '' check (char_length(orientation) <= 80),
  scale_percent numeric(6, 2) not null default 100 check (scale_percent between 10 and 300),
  quantity integer not null default 1 check (quantity between 1 and 1000000),
  print_hours numeric(9, 3) check (print_hours is null or print_hours between 0 and 100000),
  material_grams numeric(12, 3) check (material_grams is null or material_grams between 0 and 1000000),
  material_by_color jsonb not null default '[]'::jsonb check (
    case when jsonb_typeof(material_by_color) = 'array' then jsonb_array_length(material_by_color) <= 12 else false end
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, profile_name),
  foreign key (product_id, store_id) references public.marketplace_products (id, store_id) on delete cascade,
  foreign key (maker_printer_id, store_id) references public.maker_printers (id, store_id) on delete restrict,
  check ((sharing_scope = 'private' and review_status = 'draft')
    or (sharing_scope = 'community' and review_status in ('pending', 'published', 'rejected'))
    or (sharing_scope = 'official' and review_status = 'published')),
  check ((review_status in ('draft', 'pending') and reviewed_by is null and reviewed_at is null)
    or (review_status in ('published', 'rejected') and reviewed_by is not null and reviewed_at is not null))
);

create index maker_print_profiles_store_recent on public.maker_print_profiles (store_id, created_at desc);
create index maker_print_profiles_public_product on public.maker_print_profiles (product_id, profile_type) where sharing_scope in ('community', 'official') and review_status = 'published';

alter table public.maker_print_profiles enable row level security;
revoke all on public.maker_print_profiles from anon, authenticated;
grant select, insert, update, delete on public.maker_print_profiles to authenticated;
grant select on public.maker_print_profiles to anon;

create policy "Makers manage private profiles for their products"
  on public.maker_print_profiles for all to authenticated
  using (
    sharing_scope = 'private' and review_status = 'draft'
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  )
  with check (
    sharing_scope = 'private' and review_status = 'draft'
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    and exists (select 1 from public.marketplace_products p where p.id = maker_print_profiles.product_id and p.store_id = maker_print_profiles.store_id)
    and (maker_printer_id is null or exists (
      select 1 from public.maker_printers p where p.id = maker_print_profiles.maker_printer_id and p.store_id = maker_print_profiles.store_id
    ))
    and (maker_print_profiles.printer_model_id is null or exists (select 1 from public.printer_models p where p.id = maker_print_profiles.printer_model_id and p.catalog_status = 'published'))
    and (maker_print_profiles.material_id is null or exists (select 1 from public.material_catalog m where m.id = maker_print_profiles.material_id and m.catalog_status = 'published'))
    and (maker_print_profiles.nozzle_id is null or exists (select 1 from public.nozzle_catalog n where n.id = maker_print_profiles.nozzle_id and n.catalog_status = 'published'))
  );

create policy "Makers read their own community print profiles"
  on public.maker_print_profiles for select to authenticated
  using (
    sharing_scope = 'community'
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Makers submit community print profiles"
  on public.maker_print_profiles for insert to authenticated
  with check (
    sharing_scope = 'community' and review_status = 'pending'
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    and exists (select 1 from public.marketplace_products p where p.id = maker_print_profiles.product_id and p.store_id = maker_print_profiles.store_id)
    and (maker_printer_id is null or exists (select 1 from public.maker_printers p where p.id = maker_print_profiles.maker_printer_id and p.store_id = maker_print_profiles.store_id))
    and (maker_print_profiles.printer_model_id is null or exists (select 1 from public.printer_models p where p.id = maker_print_profiles.printer_model_id and p.catalog_status = 'published'))
    and (maker_print_profiles.material_id is null or exists (select 1 from public.material_catalog m where m.id = maker_print_profiles.material_id and m.catalog_status = 'published'))
    and (maker_print_profiles.nozzle_id is null or exists (select 1 from public.nozzle_catalog n where n.id = maker_print_profiles.nozzle_id and n.catalog_status = 'published'))
  );

create policy "Makers move private profiles into community review"
  on public.maker_print_profiles for update to authenticated
  using (
    sharing_scope = 'private' and review_status = 'draft'
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  )
  with check (
    sharing_scope = 'community' and review_status = 'pending'
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    and exists (select 1 from public.marketplace_products p where p.id = maker_print_profiles.product_id and p.store_id = maker_print_profiles.store_id)
    and (maker_printer_id is null or exists (select 1 from public.maker_printers p where p.id = maker_print_profiles.maker_printer_id and p.store_id = maker_print_profiles.store_id))
    and (maker_print_profiles.printer_model_id is null or exists (select 1 from public.printer_models p where p.id = maker_print_profiles.printer_model_id and p.catalog_status = 'published'))
    and (maker_print_profiles.material_id is null or exists (select 1 from public.material_catalog m where m.id = maker_print_profiles.material_id and m.catalog_status = 'published'))
    and (maker_print_profiles.nozzle_id is null or exists (select 1 from public.nozzle_catalog n where n.id = maker_print_profiles.nozzle_id and n.catalog_status = 'published'))
  );

create policy "Makers revise community profiles awaiting review"
  on public.maker_print_profiles for update to authenticated
  using (
    sharing_scope = 'community' and review_status in ('pending', 'rejected')
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  )
  with check (
    sharing_scope = 'community' and review_status = 'pending'
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    and exists (select 1 from public.marketplace_products p where p.id = maker_print_profiles.product_id and p.store_id = maker_print_profiles.store_id)
    and (maker_printer_id is null or exists (select 1 from public.maker_printers p where p.id = maker_print_profiles.maker_printer_id and p.store_id = maker_print_profiles.store_id))
    and (maker_print_profiles.printer_model_id is null or exists (select 1 from public.printer_models p where p.id = maker_print_profiles.printer_model_id and p.catalog_status = 'published'))
    and (maker_print_profiles.material_id is null or exists (select 1 from public.material_catalog m where m.id = maker_print_profiles.material_id and m.catalog_status = 'published'))
    and (maker_print_profiles.nozzle_id is null or exists (select 1 from public.nozzle_catalog n where n.id = maker_print_profiles.nozzle_id and n.catalog_status = 'published'))
  );

create policy "Makers withdraw community profiles awaiting review"
  on public.maker_print_profiles for delete to authenticated
  using (
    sharing_scope = 'community' and review_status in ('pending', 'rejected')
    and exists (select 1 from public.stores s where s.id = maker_print_profiles.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Anyone can read published shared print profiles"
  on public.maker_print_profiles for select to anon, authenticated
  using (
    sharing_scope in ('community', 'official') and review_status = 'published'
    and exists (
      select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.id = maker_print_profiles.product_id and p.catalog_status = 'published' and s.status = 'published'
    )
  );

create policy "Catalog admins curate shared print profiles"
  on public.maker_print_profiles for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));
