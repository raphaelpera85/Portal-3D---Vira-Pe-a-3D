-- Creality K2 SE data from the official product listing and Portuguese manual.
-- Rated power is a specification, not measured energy consumption.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Creality', 'K2 SE', 'standard', 'FDM', 'published',
    220, 215, 245, 1, null, null,
    300, 100, true, null,
    500, null, 'CFS (sold separately)', null,
    '{"maxAccelerationMmPerSecondSquared":20000,"extruder":"Sprite direct drive","ratedPowerWatts":350,"multicolorSupported":false,"multicolorUpgradeDescription":"CFS sold separately; up to 16 filaments with four CFS units"}'::jsonb,
    'https://store.creality.com/uk/products/k2-se-combo-3d-printer',
    'https://wiki.creality.com/products/fully-enclosed/k2se/%E8%AF%B4%E6%98%8E%E4%B9%A6/k2_se-sm-001_user_manual%28pt-br%29.pdf', date '2026-11-14'
  ),
  (
    'Creality', 'K2 SE', 'CFS 4-Color Combo', 'FDM', 'published',
    220, 215, 245, 1, null, null,
    300, 100, true, null,
    500, null, 'CFS', 4,
    '{"maxAccelerationMmPerSecondSquared":20000,"extruder":"Sprite direct drive","ratedPowerWatts":350,"cfsIncluded":true,"maximumMulticolorFilaments":16,"additionalCfsUnitsForMaximumColors":3}'::jsonb,
    'https://store.creality.com/uk/products/k2-se-combo-3d-printer',
    'https://wiki.creality.com/products/fully-enclosed/k2se/%E8%AF%B4%E6%98%8E%E4%B9%A6/k2_se-sm-001_user_manual%28pt-br%29.pdf', date '2026-11-14'
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

with links(printer_variant, material_product, compatibility, conditions) as (
  values
    ('standard', 'Hyper PLA', 'compatible', 'Filamento listado como suportado no manual da K2 SE.'),
    ('standard', 'Hyper PETG', 'compatible', 'PETG listado como suportado no manual da K2 SE.'),
    ('standard', 'HP-TPU', 'compatible', 'TPU 95A listado como suportado no manual da K2 SE.'),
    ('CFS 4-Color Combo', 'Hyper PLA', 'compatible', 'Filamento listado como suportado no manual da K2 SE.'),
    ('CFS 4-Color Combo', 'Hyper PETG', 'compatible', 'PETG listado como suportado no manual da K2 SE.'),
    ('CFS 4-Color Combo', 'HP-TPU', 'conditional', 'O manual permite TPU 95A, mas para esta configuração alimente diretamente e não use o CFS.')
)
insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select printer.id, material.id, links.compatibility, links.conditions,
       'https://wiki.creality.com/products/fully-enclosed/k2se/%E8%AF%B4%E6%98%8E%E4%B9%A6/k2_se-sm-001_user_manual%28pt-br%29.pdf',
       date '2026-11-14', 'published'
from links
join public.printer_models printer
  on printer.manufacturer = 'Creality'
  and printer.model = 'K2 SE'
  and printer.variant = links.printer_variant
  and printer.catalog_status = 'published'
join public.material_catalog material
  on material.manufacturer = 'Creality'
  and material.product = links.material_product
  and material.catalog_status = 'published'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
