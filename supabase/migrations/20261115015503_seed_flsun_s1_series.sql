-- Add FLSUN S1 models with geometry and peak speed limitations kept explicit.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, nozzle_interface, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, technical_properties,
  source_url, documentation_url, verified_at
) values
  ('FLSUN', 'S1', 'standard', 'FDM', 'published', null, null, null, 1,
   null, 'FLSUN S1', 0.4, 350, 120, true, true, 1200, null,
   '{"buildVolumeDescription":"320 × 320 × 430 mm (geometria do volume não detalhada pela fonte)","activeChamberHeating":false,"maximumChamberTemperatureC":50,"maxAccelerationMmPerSecondSquared":40000,"includedNozzle":"Aço endurecido, 0,4 mm","manufacturerSupportedMaterials":["PLA","PETG","TPU","PVA","HIPS","ABS","ASA","PC","PA","PA-CF/GF","PET-CF/GF","PPA-CF/GF"],"manufacturerSpecificationNotes":["A câmara não tem aquecimento ativo; até 50 °C é informado com hotend, mesa e gabinete fechado.","A velocidade máxima de 1.200 mm/s é um pico anunciado e varia conforme o perfil."]}'::jsonb,
   'https://flsun3d.com/pages/s1-faq', 'https://wiki.flsun3d.com/en/S1Introduction', date '2026-11-14'),
  ('FLSUN', 'S1 Pro', 'standard', 'FDM', 'published', null, null, null, 1,
   1.75, 'FLSUN S1 Pro', 0.4, 350, 120, true, true, 1200, null,
   '{"buildVolumeDescription":"Cilíndrico · Ø320 × 430 mm (altura máxima de 383 mm na borda externa)","buildVolumeShape":"cylindrical","buildDiameterMm":320,"buildHeightMm":430,"maximumHeightAtOuterEdgeMm":383,"heightLimitAppliesAtCenter":true,"maxAccelerationMmPerSecondSquared":40000,"includedNozzle":"Aço endurecido, 0,4 mm","airFilter":"HEPA + carvão ativado","manufacturerSupportedMaterials":["PLA","PETG","TPU","ABS","ASA","PA","PC","PET","PLA-CF/GF"],"manufacturerSpecificationNotes":["A velocidade de 1.200 mm/s e a aceleração de 40.000 mm/s² são picos instantâneos; valores reais se adaptam ao perfil."]}'::jsonb,
   'https://flsun3d.com/pages/s1-pro', null, date '2026-11-14')
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
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  abrasion_resistant, original, catalog_status, source_url, verified_at
) values
  ('FLSUN', 'S1 hardened steel nozzle', 'FLSUN S1', 0.4, 'Aço endurecido', 350, true, true, 'published',
   'https://flsun3d.com/pages/s1-faq', date '2026-11-14'),
  ('FLSUN', 'S1 Pro hardened steel nozzle', 'FLSUN S1 Pro', 0.4, 'Aço endurecido', 350, true, true, 'published',
   'https://flsun3d.com/pages/s1-pro', date '2026-11-14')
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
  and nozzle.diameter_mm = 0.4
  and ((printer.model = 'S1' and nozzle.model = 'S1 hardened steel nozzle')
    or (printer.model = 'S1 Pro' and nozzle.model = 'S1 Pro hardened steel nozzle'))
where printer.manufacturer = 'FLSUN'
  and printer.model in ('S1', 'S1 Pro')
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
