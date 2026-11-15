-- Official large-format Ender-5 Max specs; its enclosure is an optional accessory.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count, filament_diameter_mm,
  original_nozzle_diameter_mm, max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, multicolor_system, multicolor_filament_count, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Creality', 'Ender-5 Max', 'standard', 'FDM', 'published',
  400, 400, 400, 1, 1.75,
  0.4, 300, 100, true, false,
  700, null, null,
  '{"recommendedPrintSpeedMmPerSecond":500,"maxAccelerationMmPerSecondSquared":20000,"supportedNozzleDiametersMm":[0.4,0.6,0.8],"manufacturerSupportedMaterials":["Hyper PLA","PLA","PETG","TPU 95A","ABS","ASA","PLA-CF","PA","PLA-Silk"],"manufacturerSpecificationNotes":["A potência nominal informada é 1.250 W; o consumo médio real não foi medido.","O fabricante oferece gabinete como acessório opcional; ele não está incluído nesta variante."]}'::jsonb,
  'https://www.creality.com/br/products/creality-ender-5-max',
  'https://www.creality.com/support/creality-ender-5-max', date '2026-11-13'
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
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  original, catalog_status, source_url, documentation_url, verified_at
)
select 'Creality', 'Ender-5 Max nozzle', 'Ender-5 Max', diameter, 'Cobre', 300,
       diameter = 0.4, 'published',
       'https://www.creality.com/br/products/creality-ender-5-max',
       'https://www.creality.com/support/creality-ender-5-max', date '2026-11-13'
from unnest(array[0.4, 0.6, 0.8]::numeric[]) as sizes(diameter)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  max_temperature_c = excluded.max_temperature_c,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', 'https://www.creality.com/support/creality-ender-5-max', date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Creality'
  and nozzle.model = 'Ender-5 Max nozzle'
  and nozzle.interface = 'Ender-5 Max'
where printer.manufacturer = 'Creality'
  and printer.model = 'Ender-5 Max'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select printer.id, material.id, compatibility.status, compatibility.conditions,
  'https://www.creality.com/br/products/creality-ender-5-max', date '2026-11-13', 'published'
from public.printer_models printer
cross join (values
  ('Hyper PLA', 'compatible', 'Material suportado pelo fabricante.'),
  ('Hyper PETG', 'compatible', 'Material PETG listado pelo fabricante.'),
  ('Hyper ABS', 'compatible', 'Material listado pelo fabricante; o gabinete é acessório opcional.'),
  ('HP ASA', 'compatible', 'Material listado pelo fabricante; o gabinete é acessório opcional.'),
  ('HP-TPU', 'compatible', 'TPU 95A consta na lista oficial de filamentos suportados.')
) as compatibility(product, status, conditions)
join public.material_catalog material
  on material.manufacturer = 'Creality'
  and material.product = compatibility.product
where printer.manufacturer = 'Creality'
  and printer.model = 'Ender-5 Max'
  and printer.variant = 'standard'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
