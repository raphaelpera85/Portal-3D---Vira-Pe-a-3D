insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Mars 5', 'standard', 'MSLA', 'published',
  143.43, 89.6, 150,
  '{"resolution":"4K","resolutionPixels":"4098x2560","resolutionXYMicrons":[35,35],"layerHeightRangeMm":{"min":0.01,"max":0.2},"zAxisAccuracyMm":0.02,"maxPrintSpeedMmPerHour":70,"wavelengthNm":405,"autoLeveling":true,"powerRequirements":"100-240V 50/60Hz 24V 3A","connectivity":["USB"],"slicers":["CHITUBOX","Voxeldance Tango"]}'::jsonb,
  'https://www.elegoo.com/products/mars-5-4k-6-6inch-monochrome-lcd-resin-3d-printer',
  'https://www.elegoo.com/pages/elegoo-mars-5-series',
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
