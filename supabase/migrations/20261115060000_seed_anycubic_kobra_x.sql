-- Kobra X native ACE GEN2 colors are distinct from the included ACE 2 Pro Combo.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, original_nozzle_diameter_mm,
  nozzle_interface, max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Anycubic', 'Kobra X', 'standard', 'FDM', 'published',
    260, 260, 260, 0.4,
    'Anycubic Kobra X quick-release printhead', 300, 100, true,
    600, 'ACE GEN2', 4,
    '{"recommendedPrintSpeedMmPerSecond":300,"maxAccelerationMmPerSecondSquared":20000,"recommendedAccelerationMmPerSecondSquared":10000,"manufacturerSupportedMaterials":["PLA","PETG","TPU","PVA","PLA-CF","PETG-CF","ASA"],"maximumMulticolorFilaments":19,"extraACE2ProUnitsForMaximumColors":4,"multicolorUpgradeDescription":"Quatro cores são nativas; chegar a 19 exige quatro ACE 2 Pro adicionais e hubs de filamento. TPU 95A é indicado para material único; as combinações multimatéria publicadas usam TPU 68D."}'::jsonb,
    'https://store.anycubic.com/products/kobra-x',
    'https://store.anycubic.com/products/kobra-x',
    date '2026-11-14'
  ),
  (
    'Anycubic', 'Kobra X', 'ACE GEN2 + ACE 2 Pro Combo', 'FDM', 'published',
    260, 260, 260, 0.4,
    'Anycubic Kobra X quick-release printhead', 300, 100, true,
    600, 'ACE GEN2 + ACE 2 Pro', 7,
    '{"recommendedPrintSpeedMmPerSecond":300,"maxAccelerationMmPerSecondSquared":20000,"recommendedAccelerationMmPerSecondSquared":10000,"manufacturerSupportedMaterials":["PLA","PETG","TPU","PVA","PLA-CF","PETG-CF","ASA"],"maximumMulticolorFilaments":19,"extraACE2ProUnitsForMaximumColors":3,"ace2ProDryingMaxTemperatureC":65,"multicolorUpgradeDescription":"A Combo de sete cores inclui um ACE 2 Pro; chegar a 19 exige três ACE 2 Pro adicionais e hubs de filamento. TPU 95A é indicado para material único; as combinações multimatéria publicadas usam TPU 68D."}'::jsonb,
    'https://store.anycubic.com/products/kobra-x',
    'https://store.anycubic.com/products/ace-2-pro',
    date '2026-11-14'
  )
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
  nozzle_interface = excluded.nozzle_interface,
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
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
)
select 'Anycubic', 'Kobra X hotend', 'Anycubic Kobra X quick-release printhead', diameter,
       case when diameter = 0.25 then 'Latão' else 'Aço endurecido' end, 300,
       diameter <> 0.25, diameter = 0.4, 'published',
       'https://store.anycubic.com/products/kobra-x', 'https://store.anycubic.com/products/kobra-x',
       date '2026-11-14'
from unnest(array[0.25, 0.4, 0.6, 0.8]::numeric[]) as sizes(diameter)
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
select printer.id, nozzle.id, 'compatible',
       'Bico listado oficialmente para Kobra X; compatibilidade não inferida para outros modelos.',
       'https://store.anycubic.com/products/kobra-x', date '2026-11-14', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Anycubic'
  and nozzle.model = 'Kobra X hotend'
  and nozzle.interface = 'Anycubic Kobra X quick-release printhead'
where printer.manufacturer = 'Anycubic'
  and printer.model = 'Kobra X'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
