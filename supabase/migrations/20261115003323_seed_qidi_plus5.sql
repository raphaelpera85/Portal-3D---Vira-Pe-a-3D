-- QIDI Plus5 variants reuse the official nozzle family shared with Q2.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'QIDI Tech', 'Plus5', 'standard', 'FDM', 'published',
    320, 320, 300, 1,
    1.75, 0.4,
    370, 120, true, true,
    null, null, 'QIDI Box (vendido separadamente)', null,
    '{"maxToolheadSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":20000,"activeChamberMaximumTemperatureC":65,"ratedPowerComponentsW":[150,550,500],"maximumMulticolorFilamentsWithExtraBoxes":16}'::jsonb,
    'https://us.qidi3d.com/products/plus5', 'https://us.qidi3d.com/pages/qidi-plus5-techspecs', date '2026-11-13'
  ),
  (
    'QIDI Tech', 'Plus5', 'QIDI Box Combo', 'FDM', 'published',
    320, 320, 300, 1,
    1.75, 0.4,
    370, 120, true, true,
    null, null, 'QIDI Box', 4,
    '{"maxToolheadSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":20000,"activeChamberMaximumTemperatureC":65,"ratedPowerComponentsW":[150,550,500],"maximumMulticolorFilamentsWithExtraBoxes":16}'::jsonb,
    'https://us.qidi3d.com/products/plus5', 'https://us.qidi3d.com/pages/qidi-plus5-techspecs', date '2026-11-13'
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
  and printer.model = 'Plus5'
  and printer.variant in ('standard', 'QIDI Box Combo')
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
