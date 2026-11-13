-- Official ELEGOO Neptune 4 Max Type-C edition specifications.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  original_nozzle_diameter_mm, nozzle_interface,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Neptune 4 Max', 'Type-C version', 'FDM', 'published',
  420, 420, 480, 1,
  0.4, 'ELEGOO Neptune 4 Max custom hotend',
  300, 85, true,
  500,
  '{"defaultPrintSpeedMmPerSecond":250,"maximumToolheadAccelerationMmPerSecondSquared":8000,"supportedFilaments":["PLA","TPU","PETG","ABS","ASA","Nylon"]}'::jsonb,
  'https://www.elegoo.com/en-gb/collections/elegoo-product-ex-s4/products/neptune-4-max-fdm-3d-printer',
  'https://wiki.elegoo.com/faq/neptune-4-max-faq',
  date '2026-11-13'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
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
  manufacturer, model, interface, diameter_mm, body_material, original,
  catalog_status, source_url, documentation_url, verified_at
)
select 'ELEGOO', 'Neptune 4 Max brass nozzle', 'Neptune 4 Max custom hotend', diameter,
       'Brass', diameter = 0.4, 'published',
       'https://us.elegoo.com/products/multi-size-brass-nozzle-kit-for-neptune-4-plus-4-max',
       'https://wiki.elegoo.com/faq/neptune-4-max-faq', date '2026-11-13'
from unnest(array[0.4, 0.6, 0.8, 1.0]::numeric[]) as sizes(diameter)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible',
       'Compatível com Neptune 4 Max Type-C; confirmar a versão antes da compra.',
       'https://us.elegoo.com/products/multi-size-brass-nozzle-kit-for-neptune-4-plus-4-max',
       date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'ELEGOO'
  and nozzle.model = 'Neptune 4 Max brass nozzle'
  and nozzle.interface = 'Neptune 4 Max custom hotend'
where printer.manufacturer = 'ELEGOO'
  and printer.model = 'Neptune 4 Max'
  and printer.variant = 'Type-C version'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
