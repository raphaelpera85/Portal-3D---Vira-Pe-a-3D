-- Manufacturer-published specifications only; unconfirmed values remain NULL.
with saved_printer as (
  insert into public.printer_models (
    manufacturer, model, variant, technology, catalog_status,
    build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
    filament_diameter_mm, original_nozzle_diameter_mm,
    max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
    maximum_power_w, technical_properties, source_url, documentation_url, verified_at
  ) values (
    'Bambu Lab', 'P1S', 'standard', 'FDM', 'published',
    256, 256, 256,
    1.75, 0.4,
    300, 100, true, true,
    1000,
    '{"maxToolheadSpeedMmPerSecond":500,"maxToolheadAccelerationMmPerSecondSquared":20000,"maxHotendFlowMm3PerSecond":32,"maxHotendFlowConditions":"ABS, 150 × 150 mm, parede única, 280 °C","maximumPowerByVoltageW":{"100-120V":350,"220-240V":1000},"supportedMaterials":{"ideal":["PLA","PETG","TPU","ABS","ASA","PVA","PET"],"capable":["PA","PC"],"notRecommended":["carbon/glass fiber reinforced"]},"multicolorSystem":"AMS opcional"}'::jsonb,
    'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/',
    'https://cdn1.bambulab.com/documentation/quick-start-59b0cefdc0fc4/P1S/English%20version-Quick%20Start%20Guide%20for%20P1S.pdf',
    date '2026-11-13'
  ) on conflict (manufacturer, model, variant) do update set
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
    enclosure = excluded.enclosure,
    maximum_power_w = excluded.maximum_power_w,
    technical_properties = excluded.technical_properties,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id
), target_printer as (
  select id from saved_printer
), supported_diameters(diameter_mm) as (
  values (0.20::numeric), (0.40::numeric), (0.60::numeric), (0.80::numeric)
), saved_nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
    original, catalog_status, source_url, documentation_url, verified_at
  )
  select
    'Bambu Lab', 'P1 Series hotend', 'P1 Series hotend', diameter_mm,
    'Stainless steel', 300, diameter_mm = 0.40, 'published',
    'https://cdn1.bambulab.com/documentation/quick-start-59b0cefdc0fc4/P1S/English%20version-Quick%20Start%20Guide%20for%20P1S.pdf',
    'https://cdn1.bambulab.com/documentation/quick-start-59b0cefdc0fc4/P1S/English%20version-Quick%20Start%20Guide%20for%20P1S.pdf',
    date '2026-11-13'
  from supported_diameters
  on conflict (manufacturer, model, interface, diameter_mm) do update set
    body_material = excluded.body_material,
    max_temperature_c = excluded.max_temperature_c,
    original = excluded.original,
    catalog_status = excluded.catalog_status,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id, diameter_mm, source_url
)
insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select
  printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-13', 'published'
from target_printer printer
cross join saved_nozzles nozzle
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
