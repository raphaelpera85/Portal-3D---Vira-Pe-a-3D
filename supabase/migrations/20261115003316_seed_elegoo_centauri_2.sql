-- Official ELEGOO Centauri 2 specs; only the CANVAS Combo includes the 4-color system.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, filament_diameter_mm,
  original_nozzle_diameter_mm, max_nozzle_temperature_c, max_bed_temperature_c,
  heated_bed, max_print_speed_mm_s, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'ELEGOO', 'Centauri 2', 'standard', 'FDM', 'published',
    256, 256, 256, 1.75,
    0.4, 350, 110,
    true, 500, 'ELEGOO CANVAS (vendido separadamente)', null,
    '{"recommendedPrintSpeedMmPerSecond":250,"maximumAccelerationMmPerSecondSquared":20000,"multicolorUpgradeAvailable":true,"manufacturerSupportedMaterials":["PLA","PETG","PLA-CF","TPU"],"manufacturerSpecificationNotes":["Não recomendados: ABS, ASA, PET, PETG-CF, PA e PC.","Potência nominal informada: 350 W a 110 V ou 1.100 W a 220 V; o consumo real varia conforme o uso."]}'::jsonb,
    'https://us.elegoo.com/products/centauri-2', 'https://us.elegoo.com/products/centauri-2', date '2026-11-13'
  ),
  (
    'ELEGOO', 'Centauri 2', 'CANVAS Combo', 'FDM', 'published',
    256, 256, 256, 1.75,
    0.4, 350, 110,
    true, 500, 'ELEGOO CANVAS', 4,
    '{"recommendedPrintSpeedMmPerSecond":250,"maximumAccelerationMmPerSecondSquared":20000,"includedCanvas":true,"manufacturerSupportedMaterials":["PLA","PETG","PLA-CF","TPU"],"manufacturerSpecificationNotes":["TPU exige o adaptador Flexível e a desconexão do cabo CANVAS antes da impressão.","Não recomendados: ABS, ASA, PET, PETG-CF, PA e PC.","Potência nominal informada: 350 W a 110 V ou 1.100 W a 220 V; o consumo real varia conforme o uso."]}'::jsonb,
    'https://us.elegoo.com/products/centauri-2', 'https://us.elegoo.com/products/centauri-2', date '2026-11-13'
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
  'ELEGOO', 'Centauri 2 hotend', 'Centauri 2 integrated nozzle', 0.4,
  'Brass with hardened steel tip', true,
  350, 'published', 'https://us.elegoo.com/products/centauri-2',
  'https://us.elegoo.com/products/centauri-2', date '2026-11-13'
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
select printer.id, nozzle.id, 'compatible', 'https://us.elegoo.com/products/centauri-2', date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'ELEGOO'
  and nozzle.model = 'Centauri 2 hotend'
  and nozzle.interface = 'Centauri 2 integrated nozzle'
  and nozzle.diameter_mm = 0.4
where printer.manufacturer = 'ELEGOO'
  and printer.model = 'Centauri 2'
  and printer.variant in ('standard', 'CANVAS Combo')
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
