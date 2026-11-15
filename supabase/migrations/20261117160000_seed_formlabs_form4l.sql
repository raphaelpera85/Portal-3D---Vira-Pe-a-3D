-- Formlabs Form 4L published build volume and optical specifications.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Formlabs', 'Form 4L', 'standard', 'MSLA', 'published',
  353, 196, 350,
  '{"printEngine":"Low Force Display (LFD)","openMaterialMode":true,"layerThicknessRangeMicrons":{"min":25,"max":200}}'::jsonb,
  'https://formlabs.com/products/form-4l-basic-package/',
  'https://formlabs.com/support/What-is-the-largest-part-I-can-print-on-a-Formlabs-printer/',
  date '2026-11-15'
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
