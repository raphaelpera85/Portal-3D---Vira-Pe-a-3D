-- QIDI Q2 variants and the Q2-specific nozzle family.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'QIDI Tech', 'Q2', 'standard', 'FDM', 'published',
    270, 270, 256, 1,
    1.75, 0.4,
    370, 120, true, true,
    null, null, 'QIDI Box (vendido separadamente)', null,
    '{"maxToolheadSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":20000,"activeChamberMaximumTemperatureC":65,"ratedPowerComponentsW":[350,280],"manufacturerSupportedMaterials":["PLA","PETG","ABS","ASA","TPU","PA","PC","PPS-CF"],"maximumMulticolorFilamentsWithExtraBoxes":16}'::jsonb,
    'https://us.qidi3d.com/products/qidi-q2', 'https://us.qidi3d.com/products/qidi-q2', date '2026-11-13'
  ),
  (
    'QIDI Tech', 'Q2', 'QIDI Box Combo', 'FDM', 'published',
    270, 270, 256, 1,
    1.75, 0.4,
    370, 120, true, true,
    null, null, 'QIDI Box', 4,
    '{"maxToolheadSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":20000,"activeChamberMaximumTemperatureC":65,"ratedPowerComponentsW":[350,280],"manufacturerSupportedMaterials":["PLA","PETG","ABS","ASA","TPU","PA","PC","PPS-CF"],"maximumMulticolorFilamentsWithExtraBoxes":16}'::jsonb,
    'https://us.qidi3d.com/products/qidi-q2', 'https://us.qidi3d.com/products/qidi-q2', date '2026-11-13'
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
select 'QIDI Tech', 'Q2 nozzle', 'QIDI Q2', diameter, diameter = 0.4,
       'published', 'https://us.qidi3d.com/products/q2-bimetal-nozzles2pc',
       'https://us.qidi3d.com/products/qidi-q2', date '2026-11-13'
from unnest(array[0.2, 0.4, 0.6, 0.8]::numeric[]) as sizes(diameter)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', 'https://us.qidi3d.com/products/q2-bimetal-nozzles2pc',
       date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'QIDI Tech'
  and nozzle.model = 'Q2 nozzle'
  and nozzle.interface = 'QIDI Q2'
where printer.manufacturer = 'QIDI Tech'
  and printer.model = 'Q2'
  and printer.variant in ('standard', 'QIDI Box Combo')
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
