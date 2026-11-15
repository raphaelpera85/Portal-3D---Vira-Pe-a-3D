-- Official Kobra 3 Max V2 specs. These hotends do not fit the original Kobra 3 Max.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, original_nozzle_diameter_mm,
  nozzle_interface, max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Anycubic', 'Kobra 3 Max V2', 'standard', 'FDM', 'published',
    420, 420, 500, 0.4,
    'Anycubic Kobra 3 Max V2 quick-release printhead', 300, 90, true,
    600, null, null,
    '{"recommendedPrintSpeedMmPerSecond":300,"maxAccelerationMmPerSecondSquared":10000,"manufacturerSupportedMaterials":["PLA","PETG","TPU"],"multicolorUpgradeDescription":"ACE 2 Pro vendido separadamente; impressão multicolorida exige o sistema","manufacturerSpecificationNotes":["A tabela de especificações informa bico até 300 °C; a FAQ da mesma página menciona 350 °C. O catálogo usa o valor da tabela até confirmação do fabricante."]}'::jsonb,
    'https://store.anycubic.com/products/kobra-3-max-v2-3d-printer',
    'https://store.anycubic.com/products/kobra-3-max-v2-3d-printer',
    date '2026-11-14'
  ),
  (
    'Anycubic', 'Kobra 3 Max V2', 'ACE 2 Pro Combo', 'FDM', 'published',
    420, 420, 500, 0.4,
    'Anycubic Kobra 3 Max V2 quick-release printhead', 300, 90, true,
    600, 'ACE 2 Pro', 4,
    '{"recommendedPrintSpeedMmPerSecond":300,"maxAccelerationMmPerSecondSquared":10000,"manufacturerSupportedMaterials":["PLA","PETG","TPU"],"maximumMulticolorFilaments":8,"eightColorExpansionRequiresAdditionalHardware":true,"ace2ProDryingMaxTemperatureC":65,"tpu95aNotCompatibleWithAce2Pro":true,"manufacturerSpecificationNotes":["A tabela de especificações informa bico até 300 °C; a FAQ da mesma página menciona 350 °C. O catálogo usa o valor da tabela até confirmação do fabricante."]}'::jsonb,
    'https://store.anycubic.com/products/kobra-3-max-v2-3d-printer',
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
select 'Anycubic', 'Kobra 3 Max V2 hotend', 'Anycubic Kobra 3 Max V2 quick-release printhead', diameter,
       'Aço endurecido', 300, true, diameter = 0.4, 'published',
       'https://store.anycubic.com/products/kobra-3-max-v2-3d-printer',
       'https://store.anycubic.com/products/kobra-3-max-v2-3d-printer',
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
       'Hotend da versão V2; incompatível com Kobra 3 Max original.',
       'https://store.anycubic.com/products/kobra-3-max-v2-3d-printer', date '2026-11-14', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Anycubic'
  and nozzle.model = 'Kobra 3 Max V2 hotend'
  and nozzle.interface = 'Anycubic Kobra 3 Max V2 quick-release printhead'
where printer.manufacturer = 'Anycubic'
  and printer.model = 'Kobra 3 Max V2'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
