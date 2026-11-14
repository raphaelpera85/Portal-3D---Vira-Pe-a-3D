insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  multicolor_system, multicolor_filament_count, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Centauri Carbon 2', 'CANVAS Combo', 'FDM', 'published',
  256, 256, 256,
  350, 110, true, true,
  'ELEGOO CANVAS', 4,
  '{"advertisedVelocityMmPerSecond":500,"includedCanvas":true,"multicolorSupported":true,"manufacturerSpecificationNotes":["TPU exige o adaptador flexível e a desconexão do CANVAS antes da impressão."]}'::jsonb,
  'https://global.elegoo.com/products/centauri-carbon-2-combo',
  'https://global.elegoo.com/pages/elegoo-centauri-carbon-2-combo',
  date '2026-11-14'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  enclosure = excluded.enclosure,
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
