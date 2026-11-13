-- Publish only manufacturer-confirmed specifications for the Ender-3 V3.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, maximum_power_w,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Creality', 'Ender-3 V3', 'standard', 'FDM', 'published',
  220, 220, 250, 1,
  1.75, 0.4,
  300, 110, true,
  600, 350,
  '{"typicalPrintSpeedMmPerSecond":300,"maxAccelerationMmPerSecondSquared":20000,"motionSystem":"CoreXZ","extruder":"direct drive","nozzleMaterial":"hardened steel","supportedMaterials":["PLA","TPU 90A","PETG","ABS","PLA-CF","PETG-CF"]}'::jsonb,
  'https://www.creality.com/products/creality-ender-3-v3',
  'https://www.creality.com/support/creality-ender-3-v3',
  date '2026-11-13'
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
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  maximum_power_w = excluded.maximum_power_w,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, original,
  abrasion_resistant, catalog_status, source_url, documentation_url, verified_at
) values (
  'Creality', 'Ender-3 V3 integrated nozzle', 'Unicorn quick-swap hotend', 0.4,
  'Tri-metal with hardened-steel tip', true, true, 'published',
  'https://www.creality.com/products/creality-ender-3-v3',
  'https://www.creality.com/support/creality-ender-3-v3',
  date '2026-11-13'
)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  original = excluded.original,
  abrasion_resistant = excluded.abrasion_resistant,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', nozzle.source_url,
  date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Creality'
  and nozzle.model = 'Ender-3 V3 integrated nozzle'
  and nozzle.diameter_mm = 0.4
where printer.manufacturer = 'Creality'
  and printer.model = 'Ender-3 V3'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
