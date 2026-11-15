insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Artillery', 'Sidewinder X4 Plus', 'standard', 'FDM', 'published',
  300, 300, 400, 1,
  null, null,
  300, 100, true, null,
  500, null, null, null,
  '{"dualGearDirectExtruder":true,"autoBedLevelingPoints":121,"firmware":"Klipper","bedSurface":"PEI magnética flexível","manufacturerSupportedMaterials":["PLA","TPU","PETG","ABS","PET","Carbon"],"manufacturerSpecificationNotes":["A velocidade de 500 mm/s é o máximo anunciado; a fonte não informa as condições do teste."]}'::jsonb,
  'https://www.artillery3d.com/blogs/projects/artillery-sidewinder-x4-plus-review-3d-printer-testing-settings-tips',
  'https://www.artillery3d.com/blogs/projects/artillery-sidewinder-x4-plus-review-3d-printer-testing-settings-tips',
  date '2026-11-14'
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
