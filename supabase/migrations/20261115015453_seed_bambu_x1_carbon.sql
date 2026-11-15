-- X1-Carbon values follow Bambu Lab's current technical sheet; travel speed and voltage-dependent limits stay explicit.
with printers_to_seed(manufacturer, model, variant, multicolor_system, multicolor_filament_count, ams_properties) as (
  values
    ('Bambu Lab', 'X1-Carbon', 'standard', 'AMS (optional; expansion up to 16 filaments)', null::integer, '{"amsOptional":true,"maximumAmsUnits":4}'::jsonb),
    ('Bambu Lab', 'X1-Carbon', 'AMS Combo', 'AMS', 4, '{"amsUnitsIncluded":1,"maximumAmsUnits":4}'::jsonb)
), saved_printers as (
  insert into public.printer_models (
    manufacturer, model, variant, technology, catalog_status,
    build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count, filament_diameter_mm,
    max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
    max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
    technical_properties, source_url, documentation_url, verified_at
  )
  select manufacturer, model, variant, 'FDM', 'published',
         256, 256, 256, 1, 1.75,
         300, null, true, true,
         null, null, multicolor_system, multicolor_filament_count,
         jsonb_build_object(
           'maxToolheadSpeedMmPerSecond', 500,
           'maxToolheadAccelerationMmPerSecondSquared', 20000,
           'maxBedTemperatureByVoltageC', '{"110V":120,"220V":110}'::jsonb,
           'maximumPowerByVoltageW', '{"110V":350,"220V":1000}'::jsonb,
           'supportedNozzleDiametersMm', '[0.2,0.4,0.6,0.8]'::jsonb,
           'supportedFilaments', '["PLA","PETG","TPU","ABS","ASA","PET","PA","PC","carbon/glass fiber reinforced polymer"]'::jsonb,
           'activatedCarbonFilter', true
         ) || ams_properties,
         'https://public-cdn.bambulab.com/store/X1-Carbon%20tech%20specs.pdf',
         'https://cdn1.bambulab.com/documentation/Quick%20Start%20Guide%20for%20X1%20Combo%26X1-Carbon%20Combo-v1.pdf',
         date '2026-11-13'
  from printers_to_seed
  on conflict (manufacturer, model, variant) do update set
    technology = excluded.technology,
    catalog_status = excluded.catalog_status,
    build_volume_x_mm = excluded.build_volume_x_mm,
    build_volume_y_mm = excluded.build_volume_y_mm,
    build_volume_z_mm = excluded.build_volume_z_mm,
    extruder_count = excluded.extruder_count,
    filament_diameter_mm = excluded.filament_diameter_mm,
    max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
    max_bed_temperature_c = excluded.max_bed_temperature_c,
    heated_bed = excluded.heated_bed,
    enclosure = excluded.enclosure,
    max_print_speed_mm_s = excluded.max_print_speed_mm_s,
    maximum_power_w = excluded.maximum_power_w,
    multicolor_system = excluded.multicolor_system,
    multicolor_filament_count = excluded.multicolor_filament_count,
    technical_properties = printer_models.technical_properties || excluded.technical_properties,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id
), supported_diameters(diameter_mm) as (
  values (0.20::numeric), (0.40::numeric), (0.60::numeric), (0.80::numeric)
), saved_nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, max_temperature_c,
    body_material, original, abrasion_resistant, catalog_status,
    source_url, documentation_url, verified_at
  )
  select 'Bambu Lab', 'X1-Carbon hardened steel hotend', 'X1-Carbon hotend', diameter_mm,
         300, 'Hardened steel', diameter_mm = 0.40, true, 'published',
         'https://public-cdn.bambulab.com/store/X1-Carbon%20tech%20specs.pdf',
         'https://public-cdn.bambulab.com/store/X1-Carbon%20tech%20specs.pdf', date '2026-11-13'
  from supported_diameters
  on conflict (manufacturer, model, interface, diameter_mm) do update set
    max_temperature_c = excluded.max_temperature_c,
    body_material = excluded.body_material,
    original = excluded.original,
    abrasion_resistant = excluded.abrasion_resistant,
    catalog_status = excluded.catalog_status,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id
)
insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join saved_printers saved on saved.id = printer.id
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Bambu Lab'
  and nozzle.model = 'X1-Carbon hardened steel hotend'
  and nozzle.interface = 'X1-Carbon hotend'
join saved_nozzles saved_nozzle on saved_nozzle.id = nozzle.id
where printer.manufacturer = 'Bambu Lab'
  and printer.model = 'X1-Carbon'
  and printer.variant in ('standard', 'AMS Combo')
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
