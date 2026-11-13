-- Manufacturer-confirmed values only; leave unknown specifications unset.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  original_nozzle_diameter_mm, max_nozzle_temperature_c, max_bed_temperature_c,
  heated_bed, max_print_speed_mm_s, maximum_power_w,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Creality', 'Ender-3 V3 SE', 'standard', 'FDM', 'published',
  220, 220, 250, 1,
  0.4, 260, 100,
  true, 250, 350,
  '{"typicalPrintSpeedMmPerSecond":180,"maxAccelerationMmPerSecondSquared":2500,"nozzleMaterial":"brass","supportedMaterials":["PLA","TPU 95A","PETG"]}'::jsonb,
  'https://www.creality.com/support/creality-ender-3-v3-se',
  'https://wiki.creality.com/products/diy/ender%E7%B3%BB%E5%88%97/ender-3v3se/%E5%A4%9A%E8%AF%AD%E7%A7%8D%E8%AF%B4%E6%98%8E%E4%B9%A6/ender-3_v3_se-sm-002_user_manual%EF%BC%88en%EF%BC%89.pdf',
  date '2026-11-13'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  maximum_power_w = excluded.maximum_power_w,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
