-- Official Flashforge Adventurer 5M Pro specifications and shared AD5M-series nozzles.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Flashforge', 'Adventurer 5M Pro', 'standard', 'FDM', 'published',
  220, 220, 220, 1,
  1.75, 0.4,
  280, null, true, true,
  300, null,
  '{"layerHeightRangeMm":{"min":0.1,"max":0.4},"maxTravelSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":20000,"powerSupplyRatedOutputW":350,"extruder":"direct drive","airFiltration":"HEPA + activated carbon; internal and external circulation","connectivity":["USB","Wi-Fi","Ethernet"],"features":["one-click auto leveling","camera monitoring","filament runout reminder","power loss recovery"],"manufacturerSupportedMaterials":["PLA","PETG","TPU","ABS","ASA","PLA-CF","PETG-CF"],"materialNozzleConditions":{"PLA":"0.4 mm nozzle","PETG":"0.4 mm nozzle","TPU":"0.4 mm nozzle (recommended)","PLA-CF":"0.6 or 0.8 mm nozzle","PETG-CF":"0.6 or 0.8 mm nozzle"},"manufacturerSpecificationNotes":["The 2024 manual gives 10-300 mm/s print speed and 600 mm/s travel speed; the current product page advertises 600 mm/s as top speed.","The product page lists a 100 C platform maximum while the 2024 manual lists 110 C; the structured maximum is left unknown pending clarification.","The 350 W value is the power-supply rating, not measured average or maximum printer draw."]}'::jsonb,
  'https://www.flashforge.com/products/adventurer-5m-pro-3d-printer',
  'https://en.fss.flashforge.com/10000/software/591658f80f34f9653eaf43caccaedb14.pdf',
  date '2026-11-13'
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
  maximum_power_w = excluded.maximum_power_w,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material,
  max_temperature_c, abrasion_resistant, original, catalog_status,
  technical_properties, source_url, documentation_url, verified_at
) values
  ('Flashforge', 'Adventurer 5M Series quick-swap nozzle', 'AD5M / AD5M Pro', 0.25, null, 280, null, false, 'published', '{"maxFlowMm3PerSecond":32}'::jsonb,
   'https://www.flashforge.com/products/nozzle-kit-for-ad5m-series', 'https://www.flashforge.com/products/adventurer-5m-pro-3d-printer', date '2026-11-13'),
  ('Flashforge', 'Adventurer 5M Series quick-swap nozzle', 'AD5M / AD5M Pro', 0.4, null, 280, null, true, 'published', '{"maxFlowMm3PerSecond":32}'::jsonb,
   'https://www.flashforge.com/products/nozzle-kit-for-ad5m-series', 'https://www.flashforge.com/products/adventurer-5m-pro-3d-printer', date '2026-11-13'),
  ('Flashforge', 'Adventurer 5M Series quick-swap nozzle', 'AD5M / AD5M Pro', 0.6, null, 280, null, false, 'published', '{"maxFlowMm3PerSecond":32}'::jsonb,
   'https://www.flashforge.com/products/nozzle-kit-for-ad5m-series', 'https://www.flashforge.com/products/adventurer-5m-pro-3d-printer', date '2026-11-13'),
  ('Flashforge', 'Adventurer 5M Series quick-swap nozzle', 'AD5M / AD5M Pro', 0.8, null, 280, null, false, 'published', '{"maxFlowMm3PerSecond":32}'::jsonb,
   'https://www.flashforge.com/products/nozzle-kit-for-ad5m-series', 'https://www.flashforge.com/products/adventurer-5m-pro-3d-printer', date '2026-11-13')
on conflict (manufacturer, model, interface, diameter_mm) do update set
  max_temperature_c = excluded.max_temperature_c,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', null,
  nozzle.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Flashforge'
  and nozzle.model = 'Adventurer 5M Series quick-swap nozzle'
  and nozzle.interface = 'AD5M / AD5M Pro'
where printer.manufacturer = 'Flashforge'
  and printer.model in ('Adventurer 5M', 'Adventurer 5M Pro')
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
