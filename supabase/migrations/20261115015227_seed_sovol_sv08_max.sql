-- Sovol SV08 Max and enclosure option, from the manufacturer's product page.
-- The 1,300 W figure is the heated bed's nominal power, not measured printer consumption.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Sovol', 'SV08 Max', 'standard', 'FDM', 'published',
    500, 500, 500, null, 1.75, 0.4,
    300, 100, true, false,
    700, null, null, null,
    '{"motionSystem":"CoreXY","maxAccelerationMmPerSecondSquared":40000,"maxVolumetricFlowRateMm3PerSecond":50,"originalNozzleDiameterMm":0.4,"includedNozzleCount":2,"supportedNozzleDiametersMm":[0.4,0.6,0.8],"chamberHeatingModule":"Optional; sold separately","ratedBedPowerWatts":1300,"ratedBedPowerNote":"Nominal heated-bed power; average consumption not reported.","manufacturerSupportedMaterials":["PLA","TPU","PETG","ABS","ASA","PA","PC","PLA-CF","PETG-CF","HP-PLA"]}'::jsonb,
    'https://www.sovol3d.com/products/sovol-sv08-max-3d-printer',
    'https://www.sovol3d.com/pages/download', date '2026-11-14'
  ),
  (
    'Sovol', 'SV08 Max', 'com gabinete', 'FDM', 'published',
    500, 500, 450, null, 1.75, 0.4,
    300, 100, true, true,
    700, null, null, null,
    '{"motionSystem":"CoreXY","maxAccelerationMmPerSecondSquared":40000,"maxVolumetricFlowRateMm3PerSecond":50,"originalNozzleDiameterMm":0.4,"includedNozzleCount":2,"supportedNozzleDiametersMm":[0.4,0.6,0.8],"chamberHeatingModule":"Optional; sold separately","ratedBedPowerWatts":1300,"ratedBedPowerNote":"Nominal heated-bed power; average consumption not reported.","enclosureKitIncluded":true,"manufacturerSupportedMaterials":["PLA","TPU","PETG","ABS","ASA","PA","PC","PLA-CF","PETG-CF","HP-PLA"]}'::jsonb,
    'https://www.sovol3d.com/products/sovol-sv08-max-3d-printer',
    'https://www.sovol3d.com/pages/download', date '2026-11-14'
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
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

with supported_diameters(diameter_mm) as (
  values (0.40::numeric), (0.60::numeric), (0.80::numeric)
), saved_nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
    abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
  )
  select 'Sovol', 'SV08 Max hotend', 'SV08 Max', diameter_mm, null, 300,
         null, diameter_mm = 0.40, 'published',
         'https://www.sovol3d.com/products/sovol-sv08-max-3d-printer',
         'https://www.sovol3d.com/products/sovol-sv08-max-3d-printer', date '2026-11-14'
  from supported_diameters
  on conflict (manufacturer, model, interface, diameter_mm) do update set
    body_material = excluded.body_material,
    max_temperature_c = excluded.max_temperature_c,
    abrasion_resistant = excluded.abrasion_resistant,
    original = excluded.original,
    catalog_status = excluded.catalog_status,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id
)
insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible',
       case when nozzle.diameter_mm = 0.40 then 'A impressora inclui bico de 0,4 mm; os bicos opcionais de 0,6 e 0,8 mm são listados pela Sovol.'
            else 'Diâmetro opcional listado pelo fabricante; material do bico não especificado.' end,
       nozzle.source_url, date '2026-11-14', 'published'
from public.printer_models printer
join saved_nozzles saved on true
join public.nozzle_catalog nozzle on nozzle.id = saved.id
where printer.manufacturer = 'Sovol'
  and printer.model = 'SV08 Max'
  and printer.variant in ('standard', 'com gabinete')
  and printer.catalog_status = 'published'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
