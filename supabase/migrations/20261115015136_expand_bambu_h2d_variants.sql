-- Manufacturer-published configurations only; unknown Pro specifications stay null.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Bambu Lab', 'H2D', 'standard', 'FDM', 'published',
    325, 320, 325, 2, 1.75, 0.4,
    350, 120, true, true,
    null, null, 'AMS 2 Pro (vendido separadamente)', null,
    '{"singleNozzleBuildVolumeMm":{"x":325,"y":320,"z":325},"dualNozzleBuildVolumeMm":{"x":300,"y":320,"z":325},"combinedNozzleBuildVolumeMm":{"x":350,"y":320,"z":325},"chamberMaximumTemperatureC":65,"maxToolheadSpeedMmPerSecond":1000,"maxAccelerationMmPerSecondSquared":20000,"maxFlowMm3PerSecond":40,"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8]}'::jsonb,
    'https://blog.bambulab.com/bambu-lab-launches-h2d-to-rethink-personal-manufacturing/',
    'https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf', date '2026-11-14'
  ),
  (
    'Bambu Lab', 'H2D Pro', 'standard', 'FDM', 'published',
    null, null, null, 2, null, null,
    350, null, null, true,
    null, null, 'AMS 2 Pro + AMS HT', null,
    '{"activeChamberHeating":true,"activeChamberMaximumTemperatureC":65,"activeChamberCooling":true,"nozzleMaterial":"Tungsten carbide","ethernet":true,"wpa2EnterpriseWifi":true,"includedAmsSystems":["AMS 2 Pro","AMS HT"]}'::jsonb,
    'https://blog.bambulab.com/bambu-lab-launches-h2d-pro-for-enterprise-manufacturing/',
    'https://blog.bambulab.com/bambu-lab-launches-h2d-pro-for-enterprise-manufacturing/', date '2026-11-14'
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
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-14', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Bambu Lab'
  and nozzle.model = 'H2D hotend'
  and nozzle.interface = 'H2D hotend'
where printer.manufacturer = 'Bambu Lab'
  and printer.model = 'H2D'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
