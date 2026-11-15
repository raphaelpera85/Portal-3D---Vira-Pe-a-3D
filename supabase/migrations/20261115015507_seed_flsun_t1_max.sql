-- Add the FLSUN T1 Max with its center-to-edge cylinder limit kept explicit.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, nozzle_interface, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, technical_properties, source_url, documentation_url, verified_at
) values (
  'FLSUN', 'T1 Max', 'standard', 'FDM', 'published',
  null, null, null, null, 1.75, 'FLSUN T1 Max', 0.4,
  300, 100, true, 1000,
  '{"buildVolumeDescription":"Cilíndrico · Ø300 × 297 mm (altura máxima de 285 mm nas bordas)","buildVolumeShape":"cylindrical","buildDiameterMm":300,"buildHeightMm":297,"maximumHeightAtOuterEdgeMm":285,"heightLimitAppliesAtCenter":true,"originalNozzleMaterial":"aço endurecido","originalNozzleDiameterMm":0.4,"maxAccelerationMmPerSecondSquared":30000,"accelerationIsPeak":true,"maxVolumetricFlowRateMm3PerSecond":90,"maxVolumetricFlowTestConditions":"FLSUN PLA; vazão instantânea de pico","maximumSpeedDescription":"Até 1.000 mm/s de pico; velocidade ajustada conforme perfil e condições de impressão","manufacturerSupportedMaterials":["PLA","PLA-HS","PLA+","PLA Silk","PETG","TPU","PVA"]}'::jsonb,
  'https://us.store.flsun3d.com/products/flsun-t1-max-3d-printer',
  'https://flsun3d.sin.jp/t1-max', date '2026-11-14'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  filament_diameter_mm = excluded.filament_diameter_mm,
  nozzle_interface = excluded.nozzle_interface,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  abrasion_resistant, original, catalog_status, source_url, verified_at
) values (
  'FLSUN', 'T1 Max hardened steel nozzle', 'FLSUN T1 Max', 0.4,
  'Aço endurecido', 300, true, true, 'published',
  'https://flsun3d.sin.jp/t1-max', date '2026-11-14'
)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  max_temperature_c = excluded.max_temperature_c,
  abrasion_resistant = excluded.abrasion_resistant,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-14', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'FLSUN'
  and nozzle.model = 'T1 Max hardened steel nozzle'
  and nozzle.interface = 'FLSUN T1 Max'
  and nozzle.diameter_mm = 0.4
where printer.manufacturer = 'FLSUN'
  and printer.model = 'T1 Max'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
