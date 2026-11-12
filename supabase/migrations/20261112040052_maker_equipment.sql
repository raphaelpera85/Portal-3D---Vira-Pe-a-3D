create table public.maker_printers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  catalog_model_id uuid references public.printer_models (id) on delete restrict,
  manufacturer_snapshot text not null check (char_length(btrim(manufacturer_snapshot)) between 2 and 80),
  model_snapshot text not null check (char_length(btrim(model_snapshot)) between 1 and 80),
  variant_snapshot text not null default 'standard' check (char_length(btrim(variant_snapshot)) between 1 and 80),
  custom_manufacturer text,
  custom_model text,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 80),
  purchased_at date,
  purchase_price_brl numeric(12, 2) check (purchase_price_brl is null or purchase_price_brl > 0),
  residual_value_brl numeric(12, 2) check (residual_value_brl is null or residual_value_brl >= 0),
  useful_life_hours numeric(10, 2) check (useful_life_hours is null or useful_life_hours > 0),
  accumulated_hours numeric(10, 2) not null default 0 check (accumulated_hours >= 0),
  installed_nozzle text check (installed_nozzle is null or char_length(installed_nozzle) <= 100),
  modifications text not null default '' check (char_length(modifications) <= 1000),
  measured_average_power_w numeric(9, 2) check (measured_average_power_w is null or measured_average_power_w > 0),
  power_measurement_conditions text check (power_measurement_conditions is null or char_length(power_measurement_conditions) <= 500),
  energy_tariff_per_kwh numeric(9, 4) check (energy_tariff_per_kwh is null or energy_tariff_per_kwh >= 0),
  operational_status text not null default 'available' check (operational_status in ('available', 'maintenance', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((catalog_model_id is not null and custom_manufacturer is null and custom_model is null)
    or (catalog_model_id is null and custom_manufacturer is not null and custom_model is not null
      and char_length(btrim(custom_manufacturer)) between 2 and 80 and char_length(btrim(custom_model)) between 1 and 80)),
  check (purchase_price_brl is null or residual_value_brl is null or residual_value_brl <= purchase_price_brl),
  check (measured_average_power_w is null or (power_measurement_conditions is not null and char_length(btrim(power_measurement_conditions)) >= 5))
);

create unique index maker_printers_store_nickname on public.maker_printers (store_id, lower(btrim(nickname)));
create index maker_printers_store_recent on public.maker_printers (store_id, created_at desc);

create table public.printer_maintenance_events (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid not null references public.maker_printers (id) on delete restrict,
  performed_at date not null,
  maintenance_type text not null check (maintenance_type in ('preventive', 'corrective', 'nozzle_replacement', 'belt_replacement', 'lubrication', 'bed_replacement', 'other')),
  component text not null check (char_length(btrim(component)) between 2 and 100),
  cost_brl numeric(12, 2) not null default 0 check (cost_brl >= 0),
  hours_at_event numeric(10, 2) check (hours_at_event is null or hours_at_event >= 0),
  notes text not null default '' check (char_length(notes) <= 1000),
  next_due_at date,
  created_at timestamptz not null default now(),
  check (next_due_at is null or next_due_at >= performed_at)
);

create index printer_maintenance_history on public.printer_maintenance_events (printer_id, performed_at desc);

create function public.validate_maker_printer_dates()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.purchased_at > current_date then
    raise exception using errcode = '22023', message = 'Purchase date cannot be in the future';
  end if;
  return new;
end; $$;

create function public.validate_printer_maintenance_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.performed_at > current_date then
    raise exception using errcode = '22023', message = 'Maintenance date cannot be in the future';
  end if;
  return new;
end; $$;

revoke all on function public.validate_maker_printer_dates(), public.validate_printer_maintenance_date() from public, anon, authenticated;
create trigger validate_maker_printer_dates_before_write before insert or update on public.maker_printers
  for each row execute function public.validate_maker_printer_dates();
create trigger validate_printer_maintenance_date_before_insert before insert on public.printer_maintenance_events
  for each row execute function public.validate_printer_maintenance_date();

alter table public.maker_printers enable row level security;
alter table public.printer_maintenance_events enable row level security;
revoke all on public.maker_printers, public.printer_maintenance_events from anon, authenticated;
grant select, insert, update on public.maker_printers to authenticated;
grant select, insert on public.printer_maintenance_events to authenticated;

create policy "Makers manage equipment for their own store" on public.maker_printers for all to authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  )
  with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    and ((catalog_model_id is null and custom_manufacturer is not null and custom_model is not null)
      or (catalog_model_id is not null and custom_manufacturer is null and custom_model is null
        and exists (select 1 from public.printer_models p where p.id = catalog_model_id and p.catalog_status = 'published'
          and p.manufacturer = manufacturer_snapshot and p.model = model_snapshot and p.variant = variant_snapshot)))
  );

create policy "Makers read maintenance history for their own equipment" on public.printer_maintenance_events for select to authenticated
  using (exists (
    select 1 from public.maker_printers p join public.stores s on s.id = p.store_id
    where p.id = printer_id and s.owner_user_id = (select auth.uid())
  ) and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role));

create policy "Makers add maintenance history for their own equipment" on public.printer_maintenance_events for insert to authenticated
  with check (exists (
    select 1 from public.maker_printers p join public.stores s on s.id = p.store_id
    where p.id = printer_id and s.owner_user_id = (select auth.uid())
  ) and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role));
