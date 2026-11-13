-- Publish manufacturer-verified Original Prusa MK4S specifications and compatibility.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Prusa Research', 'MK4S', 'standard', 'FDM', 'published',
  250, 210, 220,
  1.75, 0.4,
  290, 120, true, false,
  '{"layerHeightRangeMm":{"min":0.05,"max":0.30},"powerSupplyRatedOutputW":240,"optionalMultiMaterialUpgrade":"MMU3"}'::jsonb,
  'https://www.prusa3d.com/product/original-prusa-mk4s-3d-printer/',
  'https://help.prusa3d.com/product/mk4s',
  date '2026-11-13'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  filament_diameter_mm = excluded.filament_diameter_mm,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  enclosure = excluded.enclosure,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material,
  abrasion_resistant, original, catalog_status, source_url,
  documentation_url, verified_at
) values
  ('Prusa Research', 'Prusa Nozzle', 'Nextruder', 0.25, null, null, false, 'published',
   'https://help.prusa3d.com/article/prusa-nozzle-types-for-nextruder-printers_928993',
   'https://help.prusa3d.com/product/mk4s', date '2026-11-13'),
  ('Prusa Research', 'Prusa Nozzle', 'Nextruder', 0.4, 'Brass', false, true, 'published',
   'https://www.prusa3d.com/product/original-prusa-mk4s-3d-printer/',
   'https://help.prusa3d.com/product/mk4s', date '2026-11-13'),
  ('Prusa Research', 'Prusa Nozzle', 'Nextruder', 0.6, null, null, false, 'published',
   'https://help.prusa3d.com/article/prusa-nozzle-types-for-nextruder-printers_928993',
   'https://help.prusa3d.com/product/mk4s', date '2026-11-13'),
  ('Prusa Research', 'Prusa Nozzle', 'Nextruder', 0.8, null, null, false, 'published',
   'https://help.prusa3d.com/article/prusa-nozzle-types-for-nextruder-printers_928993',
   'https://help.prusa3d.com/product/mk4s', date '2026-11-13'),
  ('Prusa Research', 'Prusa Hardened Nozzle (Nickel plated)', 'Nextruder', 0.4, 'Nickel-plated hardened steel', true, false, 'published',
   'https://www.prusa3d.com/product/prusa-hardened-nozzle-nickel-plated-0-4-mm/',
   'https://help.prusa3d.com/product/mk4s', date '2026-11-13')
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  abrasion_resistant = excluded.abrasion_resistant,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle on nozzle.manufacturer = 'Prusa Research' and nozzle.interface = 'Nextruder'
where printer.manufacturer = 'Prusa Research' and printer.model = 'MK4S' and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select printer.id, material.id, profile.compatibility, profile.conditions,
  'https://www.prusa3d.com/product/original-prusa-mk4s-3d-printer/', date '2026-11-13', 'published'
from (values
  ('Prusament PLA', 'compatible', 'PLA está listado entre os materiais suportados.'),
  ('Prusament PETG', 'compatible', 'PETG está listado entre os materiais suportados.'),
  ('Prusament TPU 95A', 'compatible', 'Materiais flexíveis estão listados entre os materiais suportados.'),
  ('Prusament PC Blend', 'compatible', 'PC está listado entre os materiais suportados; os limites de temperatura do produto cabem nos limites publicados da impressora.'),
  ('Prusament ASA', 'conditional', 'ASA exige o Original Prusa Enclosure com o acessório de filtragem.'),
  ('Prusament PETG Carbon Fiber', 'conditional', 'PETG é suportado, mas esta variante abrasiva exige o bico endurecido Prusa Nextruder de 0,4 mm.'),
  ('Prusament PA11', 'conditional', 'PA exige gabinete e filtragem. O material requer câmara de 50–60 °C; a ficha da MK4S não informa controle ativo de temperatura da câmara.'),
  ('Prusament PA11 Carbon Fiber', 'conditional', 'PA exige gabinete e filtragem; o filamento é abrasivo e sua faixa chega a 295 °C, acima do limite de 290 °C da MK4S. Use bico endurecido e perfil validado até 290 °C.')
) as profile(product, compatibility, conditions)
join public.printer_models printer
  on printer.manufacturer = 'Prusa Research' and printer.model = 'MK4S' and printer.variant = 'standard'
join public.material_catalog material
  on material.manufacturer = 'Prusa Polymers' and material.product = profile.product
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
