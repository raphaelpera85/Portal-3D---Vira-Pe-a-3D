-- Seed verified Anycubic large-format FDM and resin printer variants.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  original_nozzle_diameter_mm, nozzle_interface, max_nozzle_temperature_c,
  max_bed_temperature_c, heated_bed, enclosure, max_print_speed_mm_s,
  multicolor_system, multicolor_filament_count, technical_properties,
  source_url, documentation_url, verified_at
) values
  (
    'Anycubic', 'Kobra S1 Max', 'standard', 'FDM', 'published',
    350, 350, 350, 1, 0.4, 'Anycubic Kobra S1 Max quick-release printhead', 350,
    120, true, true, 600, null, null,
    '{"recommendedPrintSpeedMmPerSecond":300,"maxAccelerationMmPerSecondSquared":20000,"recommendedAccelerationMmPerSecondSquared":10000,"motionSystem":"CoreXY","activeChamberMaximumTemperatureC":65,"includedNozzleDiametersMm":[0.4,0.6],"supportedNozzleDiametersMm":[0.25,0.4,0.6,0.8],"maximumMulticolorFilaments":16,"extraACE2ProUnitsForMaximumColors":4,"multicolorUpgradeDescription":"ACE 2 Pro vendido separadamente; até 16 cores com quatro unidades e hubs. TPU 95A é compatível em alimentação direta, não pelo ACE."}'::jsonb,
    'https://store.anycubic.com/products/kobra-s1-max', 'https://store.anycubic.com/products/kobra-s1-max', date '2026-11-14'
  ),
  (
    'Anycubic', 'Kobra S1 Max', 'ACE 2 Pro Combo', 'FDM', 'published',
    350, 350, 350, 1, 0.4, 'Anycubic Kobra S1 Max quick-release printhead', 350,
    120, true, true, 600, 'ACE 2 Pro', 4,
    '{"recommendedPrintSpeedMmPerSecond":300,"maxAccelerationMmPerSecondSquared":20000,"recommendedAccelerationMmPerSecondSquared":10000,"motionSystem":"CoreXY","activeChamberMaximumTemperatureC":65,"includedNozzleDiametersMm":[0.4,0.6],"supportedNozzleDiametersMm":[0.25,0.4,0.6,0.8],"maximumMulticolorFilaments":16,"extraACE2ProUnitsForMaximumColors":3,"ace2ProDryingMaxTemperatureC":65,"multicolorUpgradeDescription":"Combo inclui um ACE 2 Pro de quatro cores; para 16 são necessárias três unidades adicionais e hubs. TPU 95A exige alimentação direta."}'::jsonb,
    'https://store.anycubic.com/products/kobra-s1-max-combo', 'https://store.anycubic.com/products/ace-2-pro', date '2026-11-14'
  ),
  (
    'Anycubic', 'Photon P1 Max', 'standard', 'MSLA', 'published',
    285.5, 214, 300, null, null, null, null, null, null, null, null, null, null,
    '{"lcdResolution":"12K monochrome LCD · 14 in","xyResolutionMicrons":[24.8,24.8],"layerHeightRangeMm":{"min":0.02,"max":0.15},"standardResinPrintSpeedMmPerHour":{"min":15,"max":25,"layerHeightMm":0.05},"resinVatCapacityLiters":1.9,"leveling":"Leveling-free 3.0 with feedback and self-check","dynamicVatTemperature":true,"resinAutoFill":false,"lightSource":"COB + Fresnel lens + mask","minimumLightIntensityMicrowattsPerCm2":4000,"manufacturerSupportedMaterialFamilies":["All Anycubic resins"],"ratedPowerSupplyWatts":296,"weightKg":23.1,"optionalAccessory":"AirPure 2.0"}'::jsonb,
    'https://store.anycubic.com/products/photon-p1-max-best-large-resin-3d-printer', 'https://store.anycubic.com/products/photon-p1-max-best-large-resin-3d-printer', date '2026-11-14'
  )
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
  nozzle_interface = excluded.nozzle_interface,
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
  abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
)
select 'Anycubic', 'Kobra S1 Max quick-release hotend', 'Anycubic Kobra S1 Max quick-release printhead', diameter,
       case when diameter = 0.25 then 'Latão' else 'Aço endurecido' end, 350,
       diameter <> 0.25, diameter = 0.4, 'published',
       'https://store.anycubic.com/products/kobra-s1-max', 'https://store.anycubic.com/products/kobra-s1-max', date '2026-11-14'
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
       'Bico oficialmente listado para Kobra S1 Max; 0,4 e 0,6 mm inclusos. Compatibilidade não inferida para outras impressoras.',
       'https://store.anycubic.com/products/kobra-s1-max', date '2026-11-14', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Anycubic'
  and nozzle.model = 'Kobra S1 Max quick-release hotend'
  and nozzle.interface = 'Anycubic Kobra S1 Max quick-release printhead'
where printer.manufacturer = 'Anycubic'
  and printer.model = 'Kobra S1 Max'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
