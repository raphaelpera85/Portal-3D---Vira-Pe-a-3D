create table public.model_print_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_slug text not null check (model_slug ~ '^[a-z0-9]{6,16}$'),
  profile_name text not null check (char_length(btrim(profile_name)) between 2 and 80),
  profile_type text not null check (profile_type in ('economic', 'fast', 'detailed', 'multicolor', 'custom')),
  slicer text not null check (slicer in ('Arquivo 3MF', 'Anycubic Slicer Next', 'OrcaSlicer', 'Bambu Studio', 'Cura', 'PrusaSlicer', 'Manual')),
  printer_snapshot text not null default '' check (char_length(printer_snapshot) <= 120),
  material_snapshot text not null default '' check (char_length(material_snapshot) <= 120),
  nozzle_snapshot text not null default '' check (char_length(nozzle_snapshot) <= 80),
  layer_height_mm numeric(6, 3) check (layer_height_mm is null or layer_height_mm between 0.001 and 5),
  infill_percent numeric(5, 2) check (infill_percent is null or infill_percent between 0 and 100),
  wall_count smallint check (wall_count is null or wall_count between 0 and 100),
  supports boolean not null default false,
  orientation text not null default '' check (char_length(orientation) <= 80),
  scale_percent numeric(6, 2) not null default 100 check (scale_percent between 10 and 300),
  quantity integer not null default 1 check (quantity between 1 and 1000000),
  slicer_metrics jsonb not null check (jsonb_typeof(slicer_metrics) = 'object' and octet_length(slicer_metrics::text) <= 20000),
  created_at timestamptz not null default now(),
  unique (user_id, model_slug, profile_name)
);

create index model_print_profiles_owner_recent on public.model_print_profiles (user_id, model_slug, created_at desc);
alter table public.model_print_profiles enable row level security;
revoke all on public.model_print_profiles from anon, authenticated;
grant select, insert, update, delete on public.model_print_profiles to authenticated;

create policy "Users manage their own private model print profiles"
  on public.model_print_profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
