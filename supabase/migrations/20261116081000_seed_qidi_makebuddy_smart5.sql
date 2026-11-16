insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'QIDI Tech', 'MakeBuddy Smart5', 'standard', 'FDM', 'published',
  180, 180, 180, 1,
  1.75, 0.4,
  300, 80, true, true,
  null, null, 'QIDI Box (vendido separadamente)', null,
  '{"maxToolheadSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":20000,"ratedPowerWatts":150,"ratedPowerNote":"Potência nominal; o consumo depende do uso e da tensão regional.","originalNozzleDiameterMm":0.4,"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"manufacturerSupportedMaterials":["PLA","PETG"],"airFilter":"HEPA e carvão ativado","camera":"Até 1080p","multicolorUpgradeDescription":"QIDI Box opcional; impressão em uma cor sem o acessório."}'::jsonb,
  'https://us.qidi3d.com/products/smart5', 'https://us.qidi3d.com/products/smart5', date '2026-11-16'
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
  enclosure = excluded.enclosure,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  maximum_power_w = excluded.maximum_power_w,
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, original,
  catalog_status, source_url, documentation_url, verified_at
)
select 'QIDI Tech', 'Smart5 nozzle', 'QIDI Smart5', diameter, diameter = 0.4,
       'published', 'https://us.qidi3d.com/products/smart5',
       'https://us.qidi3d.com/products/smart5-bimetal-hot-end', date '2026-11-16'
from unnest(array[0.2, 0.4, 0.6, 0.8]::numeric[]) as sizes(diameter)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select printer.id, material.id, 'compatible', null,
       'https://us.qidi3d.com/products/smart5', date '2026-11-16', 'published'
from public.printer_models printer
join public.material_catalog material
  on material.catalog_status = 'published'
  and material.process = 'filament'
  and material.family in ('PLA', 'PETG')
where printer.manufacturer = 'QIDI Tech'
  and printer.model = 'MakeBuddy Smart5'
  and printer.variant = 'standard'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', null,
       'https://us.qidi3d.com/products/smart5', date '2026-11-16', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'QIDI Tech'
  and nozzle.model = 'Smart5 nozzle'
  and nozzle.interface = 'QIDI Smart5'
where printer.manufacturer = 'QIDI Tech'
  and printer.model = 'MakeBuddy Smart5'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
