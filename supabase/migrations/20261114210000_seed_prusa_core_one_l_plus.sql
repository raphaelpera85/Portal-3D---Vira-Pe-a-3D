-- Publish both CORE One L+ hotend configurations and their verified compatibility.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  ('Prusa Research', 'CORE One L+', 'standard', 'FDM', 'published', 300, 300, 330, 1,
   1.75, 0.4, 290, 120, true, true, null, null,
   'INDX (upgrade opcional; quantidade de materiais não confirmada)', null,
   '{"activeChamberHeating":true,"activeChamberMaximumTemperatureC":60,"maxNozzleTemperatureWithHighTempHotendC":400,"layerHeightRangeMm":{"min":0.05,"max":0.3},"supportedNozzleDiametersMm":[0.25,0.4,0.6,0.8],"manufacturerSupportedMaterials":["PLA","PETG","Flex","PVA","PC","PP","CPE","PVB","ABS","ASA","HIPS","PA"],"manufacturerSpecificationNotes":["ABS, ASA, HIPS e PA exigem o sistema opcional Advanced Filtration System.","O HT Hotend que permite até 400 °C é opcional."]}'::jsonb,
   'https://www.prusa3d.com/en/product/prusa-core-one-l-3/',
   'https://help.prusa3d.com/product/core-one-l-plus', date '2026-11-13'),
  ('Prusa Research', 'CORE One L+', 'HT Hotend', 'FDM', 'published', 300, 300, 330, 1,
   1.75, 0.4, 400, 120, true, true, null, null,
   'INDX (upgrade opcional; quantidade de materiais não confirmada)', null,
   '{"activeChamberHeating":true,"activeChamberMaximumTemperatureC":60,"layerHeightRangeMm":{"min":0.05,"max":0.3},"supportedNozzleDiametersMm":[0.25,0.4,0.6,0.8],"includedHotend":"HT Hotend","includedNozzle":"ObXidian 500 endurecido, 0,4 mm","manufacturerSupportedMaterials":["PLA","PETG","Flex","PVA","PC","PP","CPE","PVB","ABS","ASA","HIPS","PA","PEKK-CF","PPS-CF","PPSU","PPA-CF"],"manufacturerSpecificationNotes":["ABS, ASA, HIPS e PA exigem o sistema opcional Advanced Filtration System."]}'::jsonb,
   'https://www.prusa3d.com/en/product/prusa-core-one-l-hightemp-hotend-2/',
   'https://help.prusa3d.com/product/core-one-l-plus', date '2026-11-13')
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

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material,
  max_temperature_c, abrasion_resistant, original, catalog_status,
  source_url, documentation_url, verified_at
) values
  ('Prusa Research', 'Prusa Nozzle CHT', 'Nextruder', 0.4, 'Latão CHT', 290, false, true, 'published',
   'https://www.prusa3d.com/en/product/prusa-core-one-l-3/',
   'https://help.prusa3d.com/article/prusa-nozzle-types-for-nextruder-printers_928993', date '2026-11-13'),
  ('Prusa Research', 'Prusa Nozzle ObXidian 500', 'Nextruder', 0.4, 'Aço endurecido ObXidian 500', 400, true, true, 'published',
   'https://www.prusa3d.com/en/product/prusa-core-one-l-hightemp-hotend-2/',
   'https://help.prusa3d.com/article/prusa-nozzle-types-for-nextruder-printers_928993', date '2026-11-13')
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  max_temperature_c = excluded.max_temperature_c,
  abrasion_resistant = excluded.abrasion_resistant,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', profile.conditions, profile.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Prusa Research'
  and nozzle.interface = 'Nextruder'
  and ((nozzle.model = 'Prusa Nozzle' and nozzle.diameter_mm in (0.25, 0.4, 0.6, 0.8))
    or (nozzle.model = 'Prusa Hardened Nozzle (Nickel plated)' and nozzle.diameter_mm = 0.4)
    or (nozzle.model = 'Prusa Nozzle CHT' and nozzle.diameter_mm = 0.4)
    or (nozzle.model = 'Prusa Nozzle ObXidian 500' and nozzle.diameter_mm = 0.4))
join (values
  ('standard', 'Use o perfil do bico instalado; os dois bicos de 0,4 mm incluídos são CHT brass high-flow (montado) e resistente à abrasão (na caixa).', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/'),
  ('HT Hotend', 'A versão HT inclui o bico ObXidian 500 de 0,4 mm; outros bicos Nextruder precisam respeitar o limite térmico de cada modelo.', 'https://help.prusa3d.com/article/prusa-nozzle-types-for-nextruder-printers_928993')
) as profile(variant, conditions, source_url) on profile.variant = printer.variant
where printer.manufacturer = 'Prusa Research'
  and printer.model = 'CORE One L+'
  and ((printer.variant = 'standard' and nozzle.model <> 'Prusa Nozzle ObXidian 500')
    or (printer.variant = 'HT Hotend' and nozzle.model = 'Prusa Nozzle ObXidian 500'))
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select printer.id, material.id, profile.compatibility, profile.conditions, profile.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join (values
  ('Prusament PLA', 'compatible', 'PLA consta na lista de materiais suportados.', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/'),
  ('Prusament PETG', 'compatible', 'PETG consta na lista de materiais suportados.', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/'),
  ('Prusament TPU 95A', 'compatible', 'Materiais flexíveis constam na lista de materiais suportados.', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/'),
  ('Prusament PC Blend', 'compatible', 'PC consta na lista de materiais suportados e a faixa do material cabe no limite do hotend padrão.', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/'),
  ('Prusament ASA', 'conditional', 'ASA exige o sistema opcional Advanced Filtration System.', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/'),
  ('Prusament PETG Carbon Fiber', 'conditional', 'PETG consta na lista suportada, mas a variante abrasiva exige bico endurecido; a caixa inclui um de 0,4 mm.', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/'),
  ('Prusament PA11', 'conditional', 'PA exige o sistema opcional Advanced Filtration System; a câmara ativa atinge 60 °C. Seque o filamento conforme o perfil do fabricante.', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/'),
  ('Prusament PA11 Carbon Fiber', 'conditional', 'PA exige filtragem e bico endurecido. O perfil pode chegar a 295 °C: use o HT Hotend ou mantenha-se até 290 °C no modelo padrão.', 'https://www.prusa3d.com/en/product/prusa-core-one-l-3/')
) as profile(product, compatibility, conditions, source_url) on true
join public.material_catalog material
  on material.manufacturer = 'Prusa Polymers'
  and material.product = profile.product
  and material.catalog_status = 'published'
where printer.manufacturer = 'Prusa Research'
  and printer.model = 'CORE One L+'
  and printer.variant in ('standard', 'HT Hotend')
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
