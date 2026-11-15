-- Official ELEGOO Neptune 4 Type-C specifications and shared Type-C nozzles.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm, nozzle_interface,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Neptune 4', 'Type-C version', 'FDM', 'published',
  225, 225, 265, 1,
  1.75, 0.4, 'ELEGOO Neptune 4/4 Pro Type-C hotend',
  300, 110, true,
  null,
  '{"maxToolheadSpeedMmPerSecond":500,"maxAccelerationMmPerSecondSquared":20000,"ratedPowerWatts":310,"manufacturerSupportedMaterials":["PLA","TPU","PETG","ABS","ASA","Nylon"]}'::jsonb,
  'https://www.elegoo.com/products/elegoo-neptune-4-fdm-3d-printer',
  'https://eu.elegoo.com/en-be/collections/edm-exclude/products/elegoo-neptune-4-fdm-3d-printer',
  date '2026-11-14'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  filament_diameter_mm = excluded.filament_diameter_mm,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
  nozzle_interface = excluded.nozzle_interface,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
)
select 'ELEGOO', 'Neptune 4/4 Pro Type-C brass nozzle', 'ELEGOO Neptune 4/4 Pro Type-C hotend', diameter,
       'Brass', 300, false, diameter = 0.4, 'published',
       'https://us.elegoo.com/collections/subscriber-exclusive-offer/products/multi-size-brass-nozzle-kit-for-neptune-4-4-pro',
       'https://eu.elegoo.com/en-pl/products/multi-size-brass-nozzle-kit-for-neptune-4-plus-4-max',
       date '2026-11-14'
from unnest(array[0.4, 0.6, 0.8, 1.0]::numeric[]) as sizes(diameter)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  max_temperature_c = excluded.max_temperature_c,
  abrasion_resistant = excluded.abrasion_resistant,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible',
       'Somente versões Type-C; a versão Ribbon-Cable usa outros diâmetros.',
       'https://us.elegoo.com/collections/subscriber-exclusive-offer/products/multi-size-brass-nozzle-kit-for-neptune-4-4-pro',
       date '2026-11-14', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'ELEGOO'
  and nozzle.model = 'Neptune 4/4 Pro Type-C brass nozzle'
  and nozzle.interface = 'ELEGOO Neptune 4/4 Pro Type-C hotend'
where printer.manufacturer = 'ELEGOO'
  and ((printer.model = 'Neptune 4' and printer.variant = 'Type-C version')
    or (printer.model = 'Neptune 4 Pro' and printer.variant = 'Type-C edition'))
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
