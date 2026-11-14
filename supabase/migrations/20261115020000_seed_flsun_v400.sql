-- Add the FLSUN V400 without converting its cylindrical build area into a box.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, technical_properties, source_url, documentation_url, verified_at
) values (
  'FLSUN', 'V400', 'standard', 'FDM', 'published',
  null, null, null, 1, 300, 110, true, null,
  '{"buildVolumeDescription":"Cilíndrico · Ø300 × 410 mm (maior altura anunciada; limite local não detalhado)","buildVolumeShape":"cylindrical","buildDiameterMm":300,"buildHeightMm":410,"heightDefinition":"highestPoint","maximumSpeedDescription":"A página do produto anuncia 600 mm/s, mas sua descrição detalhada informa 400 mm/s; confirmar perfil e revisão","manufacturerSpecificationNotes":["A ficha de produto e a descrição detalhada divergem na velocidade máxima (600/400 mm/s); o catálogo mantém a divergência explícita."]}'::jsonb,
  'https://us.store.flsun3d.com/collections/v-series/products/flsun-v400',
  'https://store.flsun3d.com/pages/v400-faq', date '2026-11-14'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
