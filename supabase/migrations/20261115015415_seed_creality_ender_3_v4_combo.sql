-- Official Ender-3 V4 Combo specs; the included CFS supports four filaments and excludes TPU.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count, filament_diameter_mm,
  original_nozzle_diameter_mm, max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, multicolor_system, multicolor_filament_count, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Creality', 'Ender-3 V4', 'Combo', 'FDM', 'published',
  220, 220, 235, 1, 1.75,
  0.4, 300, 100, true,
  500, 'Creality CFS', 4,
  '{"maxAccelerationMmPerSecondSquared":12000,"includedCfsUnits":1,"cfsExtensionsMaximum":4,"maximumMulticolorSlotsWithExpansion":16,"manufacturerSupportedMaterials":["Hyper-PLA","PLA","PETG","TPU 95A","ABS","ASA","PLA-CF","PA-CF"],"manufacturerSpecificationNotes":["O Combo inclui um CFS de quatro filamentos; o fabricante informa suporte a até quatro extensões CFS.","O CFS não aceita TPU; imprima TPU com alimentação direta, sem o CFS.","Potência nominal informada: 900 W; o consumo real depende do uso."]}'::jsonb,
  'https://www.creality.com/products/ender-3-v4-3d-printer',
  'https://www.creality.com/support/ender-3-v4-3d-printer', date '2026-11-13'
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
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, original,
  max_temperature_c, catalog_status, source_url, documentation_url, verified_at
) values (
  'Creality', 'Ender-3 V4 Combo nozzle', 'Ender-3 V4 integrated hotend', 0.4,
  'Liga de cobre', true,
  300, 'published', 'https://www.creality.com/products/ender-3-v4-3d-printer',
  'https://www.creality.com/support/ender-3-v4-3d-printer', date '2026-11-13'
)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  original = excluded.original,
  max_temperature_c = excluded.max_temperature_c,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', 'https://www.creality.com/products/ender-3-v4-3d-printer', date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Creality'
  and nozzle.model = 'Ender-3 V4 Combo nozzle'
  and nozzle.interface = 'Ender-3 V4 integrated hotend'
  and nozzle.diameter_mm = 0.4
where printer.manufacturer = 'Creality'
  and printer.model = 'Ender-3 V4'
  and printer.variant = 'Combo'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select printer.id, material.id, compatibility.status, compatibility.conditions,
  'https://www.creality.com/products/ender-3-v4-3d-printer', date '2026-11-13', 'published'
from public.printer_models printer
cross join (values
  ('Hyper PLA', 'compatible', 'Compatível com CFS.'),
  ('Hyper PETG', 'compatible', 'Compatível com CFS.'),
  ('Hyper ABS', 'compatible', 'Compatível com CFS.'),
  ('HP ASA', 'compatible', 'Compatível com CFS.'),
  ('HP-TPU', 'conditional', 'A impressora aceita TPU 95A, mas o CFS é incompatível com TPU; use alimentação direta.')
) as compatibility(product, status, conditions)
join public.material_catalog material
  on material.manufacturer = 'Creality'
  and material.product = compatibility.product
where printer.manufacturer = 'Creality'
  and printer.model = 'Ender-3 V4'
  and printer.variant = 'Combo'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
