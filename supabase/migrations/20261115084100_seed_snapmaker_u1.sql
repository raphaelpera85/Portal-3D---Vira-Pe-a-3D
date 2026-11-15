-- Snapmaker U1 specifications from the manufacturer's product page.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  filament_diameter_mm, max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Snapmaker', 'U1', 'standard', 'FDM', 'published',
  270, 270, 270,
  1.75, 300, 100, true,
  500, 'SnapSwap · quatro cabeçotes independentes', 4,
  '{"independentToolheads":4,"maxAccelerationMmPerSecondSquared":20000,"maxHotendFlowMm3PerSecond":32,"buildPlate":"Aço flexível com superfície PEI","manufacturerSupportedMaterials":["PLA","PETG","TPU","PVA","PCTG"],"materialCompatibilityConditions":{"PET, ABS, ASA, PA, PC":"Exige a tampa superior opcional.","Materiais reforçados com fibra":"Exige tampa superior e bicos de aço endurecido."},"maxInputPowerWattsByVoltage":{"220-240V":1150,"100-120V":400}}'::jsonb,
  'https://www.snapmaker.com/en/snapmaker-u1/specs',
  'https://wiki.snapmaker.com/en/FAQ/u1',
  date '2026-11-15'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  filament_diameter_mm = excluded.filament_diameter_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
