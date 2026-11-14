-- Add the FLSUN T1, preserving its cylindrical build volume.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, nozzle_interface, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, technical_properties,
  source_url, verified_at
) values (
  'FLSUN', 'T1', 'standard', 'FDM', 'published',
  null, null, null, 1, 1.75, 'FLSUN T1', 0.4,
  300, 110, true, true, 1000, 400,
  '{"buildVolumeDescription":"Cilíndrico · Ø260 × 330 mm","buildVolumeShape":"cylindrical","buildDiameterMm":260,"buildHeightMm":330,"originalNozzleMaterial":"latão","originalNozzleDiameterMm":0.4,"maxAccelerationMmPerSecondSquared":30000,"maxVolumetricFlowRateMm3PerSecond":90,"maxVolumetricFlowTestConditions":"FLSUN PLA-HS, 230 °C; método gravimétrico informado: 65 mm³/s","manufacturerSupportedMaterials":["PLA","PETG","TPU","PVA","PET","ABS","ASA","PA","PC"]}'::jsonb,
  'https://flsun3d.com/pages/t1-parameter', date '2026-11-14'
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
  enclosure = excluded.enclosure,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  maximum_power_w = excluded.maximum_power_w,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  abrasion_resistant, original, catalog_status, source_url, verified_at
) values (
  'FLSUN', 'T1 brass nozzle', 'FLSUN T1', 0.4, 'Latão', 300, false, true,
  'published', 'https://flsun3d.com/pages/t1-parameter', date '2026-11-14'
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
  and nozzle.model = 'T1 brass nozzle'
  and nozzle.interface = 'FLSUN T1'
  and nozzle.diameter_mm = 0.4
where printer.manufacturer = 'FLSUN'
  and printer.model = 'T1'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
