insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Mars 5 Ultra', 'standard', 'MSLA', 'published',
  153.36, 77.76, 165,
  '{"resolution":"9K","resolutionPixels":"8520x4320","resolutionXYMicrons":[18,18],"layerHeightRangeMm":{"min":0.01,"max":0.2},"zAxisAccuracyMm":0.02,"maxPrintSpeedMmPerHour":150,"wavelengthNm":405,"tiltReleaseTechnology":true,"autoLeveling":true,"aiCamera":true,"powerRequirements":"100-240V 50/60Hz 24V 3A"}'::jsonb,
  'https://global.elegoo.com/products/mars-5-ultra-9k-7inch-monochrome-lcd-resin-3d-printer',
  'https://download.elegoo.com/04%20LCD%20Printer/22%20Mars%205%20Ultra/ELEGOO%20MARS%205%20Ultra%20User%20Manual%20Version-Multilingual-20240504-V2.pdf',
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
  verified_at = excluded.verified_at;
