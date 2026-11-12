-- Manufacturer-listed K1 Max (2024) specs and K1-series nozzle fits only.
with printer as (
  insert into public.printer_models (
    manufacturer, model, variant, model_year, technology, catalog_status,
    build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
    filament_diameter_mm, original_nozzle_diameter_mm,
    max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
    max_print_speed_mm_s, maximum_power_w, technical_properties,
    source_url, documentation_url, verified_at
  ) values (
    'Creality', 'K1 Max', '2024', 2024, 'FDM', 'published',
    300, 300, 300, 1,
    1.75, 0.4,
    300, null, true, true,
    600, 1000,
    '{"typicalPrintSpeedMmPerSecond":300,"travelSpeedMmPerSecond":800,"maxAccelerationMmPerSecondSquared":20000,"motionSystem":"CoreXY","maxFlowMm3PerSecond":32,"optionalNozzleDiametersMm":[0.6,0.8]}'::jsonb,
    'https://store.creality.com/blogs/all/creality-k1-vs-k1-max',
    'https://www.creality.com/eu/products/creality-k1-max-3d-printer', date '2026-11-12'
  ) on conflict (manufacturer, model, variant) do update set
    model_year = excluded.model_year,
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
    verified_at = excluded.verified_at
  returning id
), nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, body_material,
    original, catalog_status, source_url, documentation_url, verified_at
  ) values
    ('Creality', 'K1 Max', 'K1 Max (2024) hotend', 0.4, null, true, 'published',
     'https://store.creality.com/blogs/all/creality-k1-vs-k1-max',
     'https://store.creality.com/products/genuine-e3d-obxidian%E2%84%A2-high-flow-nozzle-assembly', date '2026-11-12'),
    ('Creality', 'K1 Max', 'K1 Max (2024) hotend', 0.6, null, false, 'published',
     'https://store.creality.com/products/genuine-e3d-obxidian%E2%84%A2-high-flow-nozzle-assembly',
     'https://store.creality.com/products/genuine-e3d-obxidian%E2%84%A2-high-flow-nozzle-assembly', date '2026-11-12'),
    ('Creality', 'K1 Max', 'K1 Max (2024) hotend', 0.8, null, false, 'published',
     'https://store.creality.com/products/genuine-e3d-obxidian%E2%84%A2-high-flow-nozzle-assembly',
     'https://store.creality.com/products/genuine-e3d-obxidian%E2%84%A2-high-flow-nozzle-assembly', date '2026-11-12')
  on conflict (manufacturer, model, interface, diameter_mm) do update set
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
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-12', 'published'
from printer
cross join nozzles nozzle
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
