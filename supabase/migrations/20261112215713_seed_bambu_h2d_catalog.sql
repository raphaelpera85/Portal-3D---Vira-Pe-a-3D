-- Specifications and compatibility are limited to values published by Bambu Lab.
with printer as (
  insert into public.printer_models (
    manufacturer, model, variant, technology, catalog_status,
    build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
    filament_diameter_mm, original_nozzle_diameter_mm,
    max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
    max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
    technical_properties, source_url, documentation_url, verified_at
  ) values (
    'Bambu Lab', 'H2D', 'AMS 2 Pro Combo', 'FDM', 'published',
    325, 320, 325, 2, 1.75, 0.4,
    350, 120, true, true,
    1000, 2200, 'AMS 2 Pro', 4,
    '{"singleNozzleBuildVolumeMm":{"x":325,"y":320,"z":325},"dualNozzleBuildVolumeMm":{"x":300,"y":320,"z":325},"combinedNozzleBuildVolumeMm":{"x":350,"y":320,"z":325},"chamberMaximumTemperatureC":65,"maxAccelerationMmPerSecondSquared":20000,"maxFlowMm3PerSecond":40,"powerWattsByVoltage":{"110V":1320,"220V":2200},"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"supportedMaterialTypes":["PLA","PETG","TPU","PVA","BVOH","ABS","ASA","PC","PA","PET","PPA-CF/GF","PPS","PPS-CF/GF"],"ams2ProSlots":4,"maxAms2ProUnitsForDualNozzleMulticolor":2}'::jsonb,
    'https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf',
    'https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf',
    date '2026-11-12'
  ) on conflict (manufacturer, model, variant) do update set
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
    verified_at = excluded.verified_at
  returning id
), compatible_materials as (
  select m.id, m.product
  from public.material_catalog m
  where m.manufacturer = 'Bambu Lab' and m.product in ('PLA Basic', 'PPA-CF')
)
insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select p.id, m.id, 'compatible', null,
  'https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf',
  date '2026-11-12', 'published'
from printer p cross join compatible_materials m
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

with supported_diameters(diameter_mm) as (
  values (0.20::numeric), (0.40::numeric), (0.60::numeric), (0.80::numeric)
), saved_nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, body_material,
    max_temperature_c, original, catalog_status, technical_properties,
    source_url, documentation_url, verified_at
  )
  select
    'Bambu Lab', 'H2D hotend', 'H2D hotend', diameter_mm, 'Hardened steel',
    350, diameter_mm = 0.40, 'published', '{}'::jsonb,
    'https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf',
    'https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf',
    date '2026-11-12'
  from supported_diameters
  on conflict (manufacturer, model, interface, diameter_mm) do update set
    body_material = excluded.body_material,
    max_temperature_c = excluded.max_temperature_c,
    original = excluded.original,
    catalog_status = excluded.catalog_status,
    technical_properties = excluded.technical_properties,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id
)
insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select p.id, n.id, 'compatible', n.source_url, date '2026-11-12', 'published'
from public.printer_models p
join public.nozzle_catalog n
  on n.manufacturer = 'Bambu Lab' and n.model = 'H2D hotend' and n.interface = 'H2D hotend'
join saved_nozzles saved on saved.id = n.id
where p.manufacturer = 'Bambu Lab' and p.model = 'H2D' and p.variant = 'AMS 2 Pro Combo'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
