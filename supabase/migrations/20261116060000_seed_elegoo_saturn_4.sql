insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Saturn 4', 'standard', 'MSLA', 'published',
  218.88, 122.88, 220,
  '{"resolution":"12K","resolutionPixels":"11520x5120","resolutionXYMicrons":[19,24],"layerHeightRangeMm":{"min":0.01,"max":0.2},"zAxisAccuracyMm":0.02,"maxPrintSpeedMmPerHour":70,"wavelengthNm":405,"powerRequirements":"100-240V 50/60Hz 24V 6A","lcd":"10-inch monochrome","connectivity":["USB"],"system":"EL3D-3.0.1"}'::jsonb,
  'https://www.elegoo.com/products/saturn-4-12k-10inch-monochrome-lcd-resin-3d-printer',
  'https://www.elegoo.com/pages/elegoo-saturn-4',
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
