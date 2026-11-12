-- Only specifications published by the manufacturer are populated.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  original_nozzle_diameter_mm, max_nozzle_temperature_c, max_bed_temperature_c,
  heated_bed, enclosure, technical_properties, source_url, documentation_url, verified_at
) values (
  'Bambu Lab', 'P2S', 'standard', 'FDM', 'published',
  256, 256, 256,
  0.4, 300, 110,
  true, true,
  '{"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"quickSwapHotend":true}'::jsonb,
  'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/',
  'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/',
  date '2026-11-12'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  enclosure = excluded.enclosure,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
