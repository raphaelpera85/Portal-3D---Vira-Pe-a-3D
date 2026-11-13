-- Manufacturer-verified Flashforge AD5X and its distinct four-color nozzle family.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  original_nozzle_diameter_mm, max_nozzle_temperature_c,
  max_bed_temperature_c, heated_bed, max_print_speed_mm_s,
  multicolor_system, multicolor_filament_count, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Flashforge', 'AD5X', 'standard', 'FDM', 'published',
  220, 220, 220, 1,
  0.4, 280,
  110, true, 300,
  'Intelligent Filament System (IFS)', 4,
  '{"layerHeightRangeMm":{"min":0.1,"max":0.4},"maxTravelSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":20000,"maxExtruderTemperaturePublishedC":300,"nozzleAccessoryRatedTemperatureC":280,"powerSupplyRatedOutputW":650,"powerMeasurementConditions":null,"multicolorSystem":"IFS","multicolorFilamentCount":4,"manufacturerSupportedMaterials":["PLA","PETG","TPU 95A","TPU 64D-75D","PLA-CF","PETG-CF"],"materialNozzleConditions":{"TPU 95A":"0.4/0.6/0.8 mm; not compatible with IFS","PLA-CF":"0.6 or 0.8 mm hardened steel nozzle","PETG-CF":"0.6 or 0.8 mm hardened steel nozzle"},"features":["automatic leveling","filament detection","power loss recovery","USB","Wi-Fi","Ethernet"],"manufacturerSpecificationNotes":["The manual specifies 300 mm/s print speed and 600 mm/s travel speed.","The manual lists 300 C maximum extruder temperature while the AD5X nozzle accessory is rated to 280 C; the structured nozzle maximum follows the accessory rating.","650 W is the power-supply rating, not measured average or maximum printer draw.","TPU 95A must be printed in single-color mode; Flashforge states that it is not compatible with IFS."]}'::jsonb,
  'https://www.flashforge.com/products/flashforge-ad5x-3d-printer',
  'https://wiki.flashforge.com/resource/pictures/%E4%B8%AD%E6%96%87/orca_ff/ad5x%E4%B8%AD%E8%8B%B1%E6%96%87%E8%AF%B4%E6%98%8E%E4%B9%A6-20250312-tyz.pdf',
  date '2026-11-13'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
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
  manufacturer, model, interface, diameter_mm, body_material,
  max_temperature_c, abrasion_resistant, original, catalog_status,
  technical_properties, source_url, documentation_url, verified_at
) values
  ('Flashforge', 'AD5X quick-swap nozzle', 'AD5X', 0.25, 'Brass alloy with stainless steel tip', 280, false, false, 'published', '{}'::jsonb,
   'https://www.flashforge.com/products/flashforge-nozzle-assembly-for-ad5x', 'https://www.flashforge.com/products/flashforge-ad5x-3d-printer', date '2026-11-13'),
  ('Flashforge', 'AD5X quick-swap nozzle', 'AD5X', 0.4, 'Brass alloy with stainless steel tip', 280, false, true, 'published', '{}'::jsonb,
   'https://www.flashforge.com/products/flashforge-nozzle-assembly-for-ad5x', 'https://www.flashforge.com/products/flashforge-ad5x-3d-printer', date '2026-11-13'),
  ('Flashforge', 'AD5X quick-swap nozzle', 'AD5X', 0.6, 'Hardened steel', 280, true, false, 'published', '{}'::jsonb,
   'https://www.flashforge.com/products/flashforge-nozzle-assembly-for-ad5x', 'https://www.flashforge.com/products/flashforge-ad5x-3d-printer', date '2026-11-13'),
  ('Flashforge', 'AD5X quick-swap nozzle', 'AD5X', 0.8, 'Hardened steel', 280, true, false, 'published', '{}'::jsonb,
   'https://www.flashforge.com/products/flashforge-nozzle-assembly-for-ad5x', 'https://www.flashforge.com/products/flashforge-ad5x-3d-printer', date '2026-11-13')
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  max_temperature_c = excluded.max_temperature_c,
  abrasion_resistant = excluded.abrasion_resistant,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible',
  case nozzle.diameter_mm
    when 0.25 then 'Bico de precisão; não recomendado para TPU 95A nem filamentos com partículas ou fibras.'
    when 0.4 then 'Uso geral; TPU 95A requer modo de cor única e não pode usar o IFS.'
    else 'Aço endurecido indicado para filamentos abrasivos; TPU 95A pode usar este diâmetro apenas em modo de cor única.'
  end,
  nozzle.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Flashforge'
  and nozzle.model = 'AD5X quick-swap nozzle'
  and nozzle.interface = 'AD5X'
where printer.manufacturer = 'Flashforge'
  and printer.model = 'AD5X'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
