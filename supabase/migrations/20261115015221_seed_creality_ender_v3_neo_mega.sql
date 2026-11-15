-- Catalog only manufacturer-confirmed features; unknown thermal/nozzle limits stay null.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Creality', 'Ender-3 V3 Neo', 'standard', 'FDM', 'published',
    220, 220, 220, null, null, null,
    null, null, null, null,
    500, null, 'CFS nano (vendido separadamente)', null,
    '{"extruder":"Sprite 2 direct drive","builtInCamera":true,"supportedTpuHardnessRangeA":[90,95],"autoBedLeveling":true}'::jsonb,
    'https://store.creality.com/uk/products/creality-ender-3-v3-neo-3d-printer',
    'https://store.creality.com/uk/blogs/buying-guides/ender-3-v3-neo-vs-mega', date '2026-11-14'
  ),
  (
    'Creality', 'Ender-3 V3 Neo', 'CFS nano Combo', 'FDM', 'published',
    220, 220, 220, null, null, null,
    null, null, null, null,
    500, null, 'CFS nano', 4,
    '{"extruder":"Sprite 2 direct drive","builtInCamera":true,"supportedTpuHardnessRangeA":[90,95],"autoBedLeveling":true,"cfsNanoIncluded":true}'::jsonb,
    'https://store.creality.com/uk/products/creality-ender-3-v3-neo-3d-printer',
    'https://store.creality.com/uk/blogs/buying-guides/ender-3-v3-neo-vs-mega', date '2026-11-14'
  ),
  (
    'Creality', 'Ender-3 V3 Mega', 'standard', 'FDM', 'published',
    420, 420, 420, null, null, null,
    null, null, null, null,
    300, null, 'CFS nano (vendido separadamente)', null,
    '{"extruder":"Sprite 2 direct drive","supportedTpuHardnessRangeA":[85,95],"autoBedLevelingPoints":81,"maxToolheadSpeedMmPerSecond":500,"automaticFilamentRefill":true}'::jsonb,
    'https://store.creality.com/uk/products/creality-ender-3-v3-mega-3d-printer',
    'https://store.creality.com/uk/blogs/buying-guides/ender-3-v3-neo-vs-mega', date '2026-11-14'
  ),
  (
    'Creality', 'Ender-3 V3 Mega', 'CFS nano Combo', 'FDM', 'published',
    420, 420, 420, null, null, null,
    null, null, null, null,
    300, null, 'CFS nano', 4,
    '{"extruder":"Sprite 2 direct drive","supportedTpuHardnessRangeA":[85,95],"autoBedLevelingPoints":81,"maxToolheadSpeedMmPerSecond":500,"cfsNanoIncluded":true}'::jsonb,
    'https://store.creality.com/uk/products/creality-ender-3-v3-mega-3d-printer',
    'https://store.creality.com/uk/blogs/buying-guides/ender-3-v3-neo-vs-mega', date '2026-11-14'
  )
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  filament_diameter_mm = excluded.filament_diameter_mm,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  enclosure = excluded.enclosure,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  maximum_power_w = excluded.maximum_power_w,
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
