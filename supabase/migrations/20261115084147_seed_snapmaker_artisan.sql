-- Artisan's official work area changes with the selected nozzle configuration.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm, max_nozzle_temperature_c,
  max_bed_temperature_c, heated_bed, max_print_speed_mm_s,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Snapmaker', 'Artisan', 'standard', 'FDM', 'published',
  null, null, null, 2,
  1.75, 0.4, 300,
  110, true, 180,
  '{"toolheadModes":[{"mode":"artisan-left-nozzle","dimensionsMm":{"x":375,"y":400,"z":400}},{"mode":"artisan-right-nozzle","dimensionsMm":{"x":400,"y":400,"z":400}},{"mode":"artisan-dual-nozzle","dimensionsMm":{"x":350,"y":400,"z":400}}],"standardNozzleDiameterMm":0.4,"optionalNozzleDiametersMm":[0.2,0.6,0.8],"standardNozzleMaterial":"Latão","maxBedTemperatureOuterZoneC":80,"heatedBedZoneDescription":"A zona interna chega a 110 °C; a zona externa, a 80 °C.","manufacturerSupportedMaterials":["PLA","ABS","ASA","PETG","TPU ≥ 90A","Breakaway PLA","PVA","HIPS","Nylon","Nylon com fibra de carbono","Nylon com fibra de vidro"],"manufacturerSpecificationNotes":["O volume varia com o bico usado: esquerdo 375 × 400 × 400 mm; direito 400 × 400 × 400 mm; dois bicos 350 × 400 × 400 mm.","A velocidade de 180 mm/s é a máxima recomendada pelo fabricante."]}'::jsonb,
  'https://www.snapmaker.com/en/snapmaker-artisan/specs/',
  'https://www.snapmaker.com/en/snapmaker-artisan/specs/',
  date '2026-11-15'
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
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
