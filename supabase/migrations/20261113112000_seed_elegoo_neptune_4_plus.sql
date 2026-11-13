-- Official ELEGOO Neptune 4 Plus Type-C specifications and shared Plus/Max nozzles.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  original_nozzle_diameter_mm, nozzle_interface,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Neptune 4 Plus', 'Type-C version', 'FDM', 'published',
  320, 320, 385, 1,
  0.4, 'ELEGOO Neptune 4 Plus/Max custom hotend',
  300, 100, true,
  500,
  '{"defaultPrintSpeedMmPerSecond":250,"maximumToolheadAccelerationMmPerSecondSquared":12000,"supportedFilaments":["PLA","TPU","PETG","ABS","ASA","Nylon"]}'::jsonb,
  'https://www.elegoo.com/collections/elegoo-new-products-2023/products/neptune-4-plus-fdm-3d-printer',
  'https://wiki.elegoo.com/neptune/nozzle-clogging',
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

update public.nozzle_catalog
set model = 'Neptune 4 Plus/Max brass nozzle',
    interface = 'Neptune 4 Plus/Max custom hotend',
    source_url = 'https://us.elegoo.com/products/multi-size-brass-nozzle-kit-for-neptune-4-plus-4-max',
    documentation_url = 'https://wiki.elegoo.com/neptune/nozzle-clogging',
    verified_at = date '2026-11-13'
where manufacturer = 'ELEGOO'
  and model = 'Neptune 4 Max brass nozzle'
  and interface = 'Neptune 4 Max custom hotend';

update public.printer_models
set nozzle_interface = 'ELEGOO Neptune 4 Plus/Max custom hotend'
where manufacturer = 'ELEGOO'
  and model = 'Neptune 4 Max'
  and variant = 'Type-C version'
  and nozzle_interface = 'ELEGOO Neptune 4 Max custom hotend';

update public.printer_nozzle_compatibility compatibility
set conditions = 'Bicos originais compartilhados entre Neptune 4 Plus e 4 Max; confirmar a versão da impressora antes da compra.'
from public.printer_models printer
where compatibility.printer_id = printer.id
  and printer.manufacturer = 'ELEGOO'
  and printer.model = 'Neptune 4 Max'
  and printer.variant = 'Type-C version';

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible',
       'Bicos originais compartilhados entre Neptune 4 Plus e 4 Max; confirmar a versão da impressora antes da compra.',
       'https://us.elegoo.com/products/multi-size-brass-nozzle-kit-for-neptune-4-plus-4-max',
       date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'ELEGOO'
  and nozzle.model = 'Neptune 4 Plus/Max brass nozzle'
  and nozzle.interface = 'Neptune 4 Plus/Max custom hotend'
where printer.manufacturer = 'ELEGOO'
  and printer.model = 'Neptune 4 Plus'
  and printer.variant = 'Type-C version'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
