-- Separate Bambu Lab toolhead travel speed from actual print speed.
update public.printer_models
set max_print_speed_mm_s = null,
    technical_properties = coalesce(technical_properties, '{}'::jsonb)
      || '{"maxToolheadSpeedMmPerSecond":500,"maxAccelerationMmPerSecondSquared":10000,"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8]}'::jsonb
where manufacturer = 'Bambu Lab'
  and ((model = 'A1' and variant = 'standard') or (model = 'A1 mini' and variant = 'Combo'));

insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  ('Bambu Lab', 'A1 mini', 'standard', 'FDM', 'published',
   180, 180, 180, 1, 1.75, 0.4,
   300, 80, true, null,
   null, 150, 'AMS lite (vendido separadamente)', 4,
   '{"maxToolheadSpeedMmPerSecond":500,"maxAccelerationMmPerSecondSquared":10000,"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8]}'::jsonb,
   'https://cdn1.bambulab.com/documentation/quick-start-f507128172bdf/Quick%20start%20guide%20-%20A1%20mini-EN.pdf',
   'https://cdn1.bambulab.com/documentation/quick-start-f507128172bdf/Quick%20start%20guide%20-%20A1%20mini-EN.pdf', date '2026-11-12'),
  ('Creality', 'Ender-3 V3 Plus', 'standard', 'FDM', 'published',
   300, 300, 330, 1, 1.75, 0.4,
   300, 100, true, null,
   600, 350, null, null,
   '{"typicalPrintSpeedMmPerSecond":300,"maxAccelerationMmPerSecondSquared":20000,"motionSystem":"CoreXZ"}'::jsonb,
   'https://store.creality.com/products/ender-3-v3-plus-3d-printer',
   'https://store.creality.com/blogs/all/ender-3-v3-plus-review', date '2026-11-12')
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

-- The official A1 mini guide lists the same hotend diameters for both variants.
insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-12', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Bambu Lab' and nozzle.model = 'A1 mini'
where printer.manufacturer = 'Bambu Lab'
  and printer.model = 'A1 mini'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select target.id, relation.material_id, relation.compatibility, relation.conditions,
       relation.source_url, date '2026-11-12', 'published'
from public.printer_models target
join public.printer_models combo
  on combo.manufacturer = target.manufacturer
  and combo.model = target.model
  and combo.variant = 'Combo'
join public.printer_material_compatibility relation on relation.printer_id = combo.id
where target.manufacturer = 'Bambu Lab'
  and target.model = 'A1 mini'
  and target.variant = 'standard'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, original,
  catalog_status, source_url, documentation_url, verified_at
) values (
  'Creality', 'Ender-3 V3 Plus integrated nozzle', 'Unicorn quick-swap hotend', 0.4, 'Tri-metal', true,
  'published',
  'https://store.creality.com/blogs/all/ender-3-v3-plus-review',
  'https://store.creality.com/products/ender-3-v3-plus-3d-printer', date '2026-11-12'
)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-12', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Creality'
  and nozzle.model = 'Ender-3 V3 Plus integrated nozzle'
  and nozzle.diameter_mm = 0.4
where printer.manufacturer = 'Creality'
  and printer.model = 'Ender-3 V3 Plus'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
