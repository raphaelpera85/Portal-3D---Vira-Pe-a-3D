insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  technical_properties, source_url, documentation_url, verified_at,
  commercial_status, commercial_status_source_url, commercial_status_checked_at
) values (
  'ELEGOO', 'Saturn 4 Ultra', '16K', 'MSLA', 'published',
  211.68, 118.37, 220,
  '{"resolution":"16K","resolutionPixels":"15120x6230","resolutionXYMicrons":[14,19],"zAxisAccuracyMm":0.02,"maxPrintSpeedMmPerHour":150,"smartResinTankTemperatureC":30,"autoLeveling":true,"tiltReleaseTechnology":true,"aiCamera":true}'::jsonb,
  'https://global.elegoo.com/products/saturn-4-ultra-16k-10inch-monochrome-lcd-resin-3d-printer',
  'https://www.elegoo.com/blogs/news/elegoo-unveils-saturn-4-ultra-16k-a-major-leap-in-accuracy-and-user-experience',
  date '2026-11-14', 'available',
  'https://global.elegoo.com/products/saturn-4-ultra-16k-10inch-monochrome-lcd-resin-3d-printer',
  date '2026-11-14'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at,
  commercial_status = excluded.commercial_status,
  commercial_status_source_url = excluded.commercial_status_source_url,
  commercial_status_checked_at = excluded.commercial_status_checked_at;
