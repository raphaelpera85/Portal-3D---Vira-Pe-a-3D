create table public.printer_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null check (btrim(manufacturer) <> ''),
  model text not null check (btrim(model) <> ''),
  variant text not null default 'standard',
  model_year smallint check (model_year between 1970 and 2100),
  technology text not null check (technology in ('FDM', 'SLA', 'MSLA', 'DLP')),
  catalog_status text not null default 'draft' check (catalog_status in ('draft', 'published', 'archived')),
  build_volume_x_mm numeric(9, 2) check (build_volume_x_mm > 0),
  build_volume_y_mm numeric(9, 2) check (build_volume_y_mm > 0),
  build_volume_z_mm numeric(9, 2) check (build_volume_z_mm > 0),
  extruder_count smallint check (extruder_count > 0),
  filament_diameter_mm numeric(5, 2) check (filament_diameter_mm > 0),
  nozzle_interface text,
  original_nozzle_diameter_mm numeric(5, 2) check (original_nozzle_diameter_mm > 0),
  max_nozzle_temperature_c numeric(6, 2) check (max_nozzle_temperature_c > 0),
  max_bed_temperature_c numeric(6, 2) check (max_bed_temperature_c > 0),
  heated_bed boolean,
  enclosure boolean,
  max_print_speed_mm_s numeric(8, 2) check (max_print_speed_mm_s > 0),
  maximum_power_w numeric(9, 2) check (maximum_power_w > 0),
  measured_average_power_w numeric(9, 2) check (measured_average_power_w > 0),
  average_power_conditions text,
  multicolor_system text,
  multicolor_filament_count smallint check (multicolor_filament_count > 1),
  technical_properties jsonb not null default '{}'::jsonb check (jsonb_typeof(technical_properties) = 'object'),
  documentation_url text,
  source_url text,
  verified_at date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (manufacturer, model, variant),
  check (catalog_status <> 'published' or (source_url is not null and source_url like 'https://%' and verified_at is not null))
);

create table public.material_catalog (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null check (btrim(manufacturer) <> ''),
  product text not null check (btrim(product) <> ''),
  family text not null check (btrim(family) <> ''),
  process text not null check (process in ('filament', 'resin')),
  catalog_status text not null default 'draft' check (catalog_status in ('draft', 'published', 'archived')),
  filament_diameter_mm numeric(5, 2) check (filament_diameter_mm > 0),
  density_g_cm3 numeric(7, 4) check (density_g_cm3 > 0),
  colors jsonb not null default '[]'::jsonb check (jsonb_typeof(colors) = 'array'),
  nozzle_temperature_min_c numeric(6, 2) check (nozzle_temperature_min_c > 0),
  nozzle_temperature_max_c numeric(6, 2) check (nozzle_temperature_max_c > 0),
  bed_temperature_min_c numeric(6, 2) check (bed_temperature_min_c >= 0),
  bed_temperature_max_c numeric(6, 2) check (bed_temperature_max_c >= 0),
  requires_enclosure boolean,
  abrasive boolean,
  multicolor_compatible boolean,
  drying_required boolean,
  drying_temperature_c numeric(6, 2) check (drying_temperature_c > 0),
  drying_hours numeric(6, 2) check (drying_hours > 0),
  max_print_speed_mm_s numeric(8, 2) check (max_print_speed_mm_s > 0),
  resin_wavelength_nm numeric(7, 2) check (resin_wavelength_nm > 0),
  resin_exposure_seconds numeric(7, 2) check (resin_exposure_seconds > 0),
  technical_properties jsonb not null default '{}'::jsonb check (jsonb_typeof(technical_properties) = 'object'),
  documentation_url text,
  source_url text,
  verified_at date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (manufacturer, product),
  check (nozzle_temperature_min_c is null or nozzle_temperature_max_c is null or nozzle_temperature_max_c >= nozzle_temperature_min_c),
  check (bed_temperature_min_c is null or bed_temperature_max_c is null or bed_temperature_max_c >= bed_temperature_min_c),
  check (catalog_status <> 'published' or (source_url is not null and source_url like 'https://%' and verified_at is not null))
);

create table public.nozzle_catalog (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null check (btrim(manufacturer) <> ''),
  model text not null check (btrim(model) <> ''),
  interface text,
  diameter_mm numeric(5, 2) not null check (diameter_mm > 0),
  body_material text,
  max_temperature_c numeric(6, 2) check (max_temperature_c > 0),
  abrasion_resistant boolean,
  original boolean not null default false,
  catalog_status text not null default 'draft' check (catalog_status in ('draft', 'published', 'archived')),
  technical_properties jsonb not null default '{}'::jsonb check (jsonb_typeof(technical_properties) = 'object'),
  documentation_url text,
  source_url text,
  verified_at date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (manufacturer, model, interface, diameter_mm),
  check (catalog_status <> 'published' or (source_url is not null and source_url like 'https://%' and verified_at is not null))
);

create table public.printer_material_compatibility (
  printer_id uuid not null references public.printer_models (id) on delete cascade,
  material_id uuid not null references public.material_catalog (id) on delete cascade,
  compatibility text not null check (compatibility in ('compatible', 'conditional', 'incompatible', 'unverified')),
  conditions text,
  source_url text,
  verified_at date,
  catalog_status text not null default 'draft' check (catalog_status in ('draft', 'published', 'archived')),
  primary key (printer_id, material_id),
  check (catalog_status <> 'published' or (source_url is not null and source_url like 'https://%' and verified_at is not null))
);

create table public.printer_nozzle_compatibility (
  printer_id uuid not null references public.printer_models (id) on delete cascade,
  nozzle_id uuid not null references public.nozzle_catalog (id) on delete cascade,
  fit text not null check (fit in ('compatible', 'conditional', 'incompatible', 'unverified')),
  conditions text,
  source_url text,
  verified_at date,
  catalog_status text not null default 'draft' check (catalog_status in ('draft', 'published', 'archived')),
  primary key (printer_id, nozzle_id),
  check (catalog_status <> 'published' or (source_url is not null and source_url like 'https://%' and verified_at is not null))
);

create index printer_models_public_lookup on public.printer_models (manufacturer, model) where catalog_status = 'published';
create index material_catalog_public_lookup on public.material_catalog (manufacturer, family) where catalog_status = 'published';
create index nozzle_catalog_public_lookup on public.nozzle_catalog (manufacturer, diameter_mm) where catalog_status = 'published';
create index printer_materials_lookup on public.printer_material_compatibility (printer_id, compatibility) where catalog_status = 'published';
create index printer_nozzles_lookup on public.printer_nozzle_compatibility (printer_id, fit) where catalog_status = 'published';

create function public.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_catalog_admin() from public;
grant execute on function public.is_catalog_admin() to authenticated;

alter table public.printer_models enable row level security;
alter table public.material_catalog enable row level security;
alter table public.nozzle_catalog enable row level security;
alter table public.printer_material_compatibility enable row level security;
alter table public.printer_nozzle_compatibility enable row level security;

revoke all on public.printer_models, public.material_catalog, public.nozzle_catalog,
  public.printer_material_compatibility, public.printer_nozzle_compatibility from anon, authenticated;
grant select on public.printer_models, public.material_catalog, public.nozzle_catalog,
  public.printer_material_compatibility, public.printer_nozzle_compatibility to anon, authenticated;
grant insert, update, delete on public.printer_models, public.material_catalog, public.nozzle_catalog,
  public.printer_material_compatibility, public.printer_nozzle_compatibility to authenticated;

create policy "Anyone can read published printer models"
  on public.printer_models for select to anon, authenticated
  using (catalog_status = 'published');
create policy "Catalog admins can manage printer models"
  on public.printer_models for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

create policy "Anyone can read published materials"
  on public.material_catalog for select to anon, authenticated
  using (catalog_status = 'published');
create policy "Catalog admins can manage materials"
  on public.material_catalog for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

create policy "Anyone can read published nozzles"
  on public.nozzle_catalog for select to anon, authenticated
  using (catalog_status = 'published');
create policy "Catalog admins can manage nozzles"
  on public.nozzle_catalog for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

create policy "Anyone can read published printer material compatibility"
  on public.printer_material_compatibility for select to anon, authenticated
  using (
    catalog_status = 'published'
    and exists (
      select 1 from public.printer_models p
      where p.id = printer_id and p.catalog_status = 'published'
    )
    and exists (
      select 1 from public.material_catalog m
      where m.id = material_id and m.catalog_status = 'published'
    )
  );
create policy "Catalog admins can manage printer material compatibility"
  on public.printer_material_compatibility for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

create policy "Anyone can read published printer nozzle compatibility"
  on public.printer_nozzle_compatibility for select to anon, authenticated
  using (
    catalog_status = 'published'
    and exists (
      select 1 from public.printer_models p
      where p.id = printer_id and p.catalog_status = 'published'
    )
    and exists (
      select 1 from public.nozzle_catalog n
      where n.id = nozzle_id and n.catalog_status = 'published'
    )
  );
create policy "Catalog admins can manage printer nozzle compatibility"
  on public.printer_nozzle_compatibility for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));
