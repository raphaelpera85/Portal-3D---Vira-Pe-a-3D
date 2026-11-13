-- QIDI Max4: manufacturer-rated toolhead speed is not a printing speed.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'QIDI Tech', 'Max4', 'standard', 'FDM', 'published',
  390, 390, 340, 1,
  1.75, 0.4,
  370, 120, true, true,
  null, null, 'QIDI Box (vendido separadamente)', null,
  '{"maxToolheadSpeedMmPerSecond":800,"maxAccelerationMmPerSecondSquared":30000,"activeChamberMaximumTemperatureC":65,"ratedPowerComponentsW":[150,500,700],"manufacturerSupportedMaterials":["PLA","ABS","ASA","PETG","TPU","PA","PC","PPS-CF"]}'::jsonb,
  'https://us.qidi3d.com/pages/qidi-max4-techspecs', 'https://us.qidi3d.com/pages/qidi-max4-techspecs', date '2026-11-13'
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
select 'QIDI Tech', 'Max4 nozzle', 'QIDI Max4', diameter, diameter = 0.4,
       'published', 'https://us.qidi3d.com/pages/qidi-max4-techspecs',
       'https://us.qidi3d.com/pages/qidi-max4-techspecs', date '2026-11-13'
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
select printer.id, nozzle.id, 'compatible', 'https://us.qidi3d.com/pages/qidi-max4-techspecs',
       date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'QIDI Tech'
  and nozzle.model = 'Max4 nozzle'
  and nozzle.interface = 'QIDI Max4'
where printer.manufacturer = 'QIDI Tech'
  and printer.model = 'Max4'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
