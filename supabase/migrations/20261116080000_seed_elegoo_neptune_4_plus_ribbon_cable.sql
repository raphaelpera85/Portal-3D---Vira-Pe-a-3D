-- Official ELEGOO Neptune 4 Plus Ribbon-Cable catalog variant.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Neptune 4 Plus', 'Ribbon-Cable version', 'FDM', 'published',
  320, 320, 385, 1,
  300, 100, true,
  500,
  '{"defaultPrintSpeedMmPerSecond":250,"maximumToolheadAccelerationMmPerSecondSquared":12000,"supportedFilaments":["PLA","TPU","PETG","ABS","ASA","Nylon"],"firmwareNotInterchangeableWithTypeC":true}'::jsonb,
  'https://us.elegoo.com/products/neptune-4-plus-fdm-3d-printer',
  'https://wiki.elegoo.com/neptune/neptune-4-plus-max-how-to-use-motherboard-and-touch-screen-firmware',
  date '2026-11-14'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
