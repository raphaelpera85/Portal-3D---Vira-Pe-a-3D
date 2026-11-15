-- Creality K2 base and CFS Combo; only the Combo includes a CFS unit.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Creality', 'K2', 'standard', 'FDM', 'published',
    260, 260, 260, 1, 1.75, 0.4,
    300, 100, true, true,
    600, 'Creality CFS (vendido separadamente)', null,
    '{"maxAccelerationMmPerSecondSquared":20000,"maximumCfsUnits":4,"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"supportedFilaments":["PLA","PLA-CF","PETG","PET","ABS"],"powerSupplyRatedOutputWattsByVoltage":{"110V":450,"220V":1350}}'::jsonb,
    'https://www.creality.com/support/k2-series-3d-printer', 'https://wiki.creality.com/products/fully-enclosed/k2/%E5%A4%9A%E8%AF%AD%E7%A7%8D%E8%AF%B4%E6%98%8E%E4%B9%A6/k2-sm-001_%E8%AF%B4%E6%98%8E%E4%B9%A6%28%E8%8B%B1%E6%96%87%29.pdf', date '2026-11-14'
  ),
  (
    'Creality', 'K2', 'CFS Combo', 'FDM', 'published',
    260, 260, 260, 1, 1.75, 0.4,
    300, 100, true, true,
    600, 'Creality CFS', 4,
    '{"maxAccelerationMmPerSecondSquared":20000,"includedCfsUnits":1,"maximumCfsUnits":4,"maximumMulticolorFilaments":16,"extraCfsUnitsForMaximumColors":3,"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"supportedFilaments":["PLA","PLA-CF","PETG","PET","ABS"],"powerSupplyRatedOutputWattsByVoltage":{"110V":450,"220V":1350}}'::jsonb,
    'https://store.creality.com/products/k2-combo-3d-printer', 'https://www.creality.com/support/k2-series-3d-printer', date '2026-11-14'
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
  enclosure = excluded.enclosure,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  abrasion_resistant, original,
  catalog_status, source_url, documentation_url, verified_at
)
select 'Creality', 'K2 nozzle', 'K2', diameter, 'Hardened steel', 300, true, diameter = 0.4,
       'published', 'https://www.creality.com/support/k2-series-3d-printer',
       'https://wiki.creality.com/products/fully-enclosed/k2/%E5%A4%9A%E8%AF%AD%E7%A7%8D%E8%AF%B4%E6%98%8E%E4%B9%A6/k2-sm-001_%E8%AF%B4%E6%98%8E%E4%B9%A6%28%E8%8B%B1%E6%96%87%29.pdf', date '2026-11-14'
from unnest(array[0.2, 0.4, 0.6, 0.8]::numeric[]) as sizes(diameter)
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
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', 'https://www.creality.com/support/k2-series-3d-printer',
       date '2026-11-14', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Creality'
  and nozzle.model = 'K2 nozzle'
  and nozzle.interface = 'K2'
where printer.manufacturer = 'Creality'
  and printer.model = 'K2'
  and printer.variant in ('standard', 'CFS Combo')
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
