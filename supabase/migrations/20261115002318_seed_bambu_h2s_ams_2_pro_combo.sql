-- The manufacturer confirms the included AMS 2 Pro but this source does not state a filament count.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  max_nozzle_temperature_c, enclosure, multicolor_system, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Bambu Lab', 'H2S', 'AMS 2 Pro Combo', 'FDM', 'published',
  340, 320, 340,
  350, true, 'AMS 2 Pro',
  '{"activeChamberHeating":true,"maximumChamberTemperatureC":65,"maxToolheadSpeedMmPerSecond":1000,"maxToolheadAccelerationMmPerSecondSquared":20000,"ams2ProIncluded":true}'::jsonb,
  'https://blog.bambulab.com/h2s-the-ultimate-single-nozzle-3d-printer-now-bigger-than-ever/',
  'https://blog.bambulab.com/h2s-the-ultimate-single-nozzle-3d-printer-now-bigger-than-ever/',
  date '2026-11-13'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  enclosure = excluded.enclosure,
  multicolor_system = excluded.multicolor_system,
  technical_properties = printer_models.technical_properties || excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
