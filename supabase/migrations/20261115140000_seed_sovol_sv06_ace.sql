-- Sovol SV06 ACE specifications and officially listed nozzle options.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Sovol', 'SV06 ACE', 'standard', 'FDM', 'published',
  220, 220, 250, null, 1.75, 0.4,
  300, 100, true, false,
  600, null, null, null,
  '{"maxAccelerationMmPerSecondSquared":20000,"typicalPrintSpeedRangeMmPerSecond":{"min":250,"max":300},"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"manufacturerSupportedMaterials":["PLA","PETG","TPU","PVA","ABS"],"manufacturerMaterialConditions":{"ABS":"The manufacturer recommends an enclosure for ABS."},"manufacturerSpecificationNotes":["The product table lists PLA, PETG, TPU and PVA; the FAQ also lists ABS and recommends an enclosure."]}'::jsonb,
  'https://www.sovol3d.com/products/sovol-sv06-ace',
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

with supported_nozzles(model, diameter_mm, body_material, abrasion_resistant, original) as (
  values
    ('SV06 ACE brass nozzle', 0.20::numeric, 'Brass', false, false),
    ('SV06 ACE brass nozzle', 0.40::numeric, 'Brass', false, true),
    ('SV06 ACE brass nozzle', 0.60::numeric, 'Brass', false, false),
    ('SV06 ACE brass nozzle', 0.80::numeric, 'Brass', false, false),
    ('SV06 ACE hardened steel nozzle', 0.40::numeric, 'Hardened steel (SKD11)', true, false)
), saved_nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
    abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
  )
  select 'Sovol', supported_nozzles.model, 'SV06 ACE', supported_nozzles.diameter_mm,
         supported_nozzles.body_material, 300, supported_nozzles.abrasion_resistant,
         supported_nozzles.original, 'published',
         case when supported_nozzles.abrasion_resistant then 'https://www.sovol3d.com/products/0-4mm-sv06-ace-hardened-steel-nozzle-kit'
              else 'https://www.sovol3d.com/products/sv06-ace-nozzle-kit-0-2-0-4mm-0-6mm-0-8mm' end,
         case when supported_nozzles.abrasion_resistant then 'https://www.sovol3d.com/products/0-4mm-sv06-ace-hardened-steel-nozzle-kit'
              else 'https://www.sovol3d.com/products/sv06-ace-nozzle-kit-0-2-0-4mm-0-6mm-0-8mm' end,
         date '2026-11-14'
  from supported_nozzles
  on conflict (manufacturer, model, interface, diameter_mm) do update set
    body_material = excluded.body_material,
    max_temperature_c = excluded.max_temperature_c,
    abrasion_resistant = excluded.abrasion_resistant,
    original = excluded.original,
    catalog_status = excluded.catalog_status,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id, model, diameter_mm, source_url, abrasion_resistant, original
)
insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible',
       case
         when nozzle.abrasion_resistant then 'Acessório oficial opcional: aço endurecido SKD11 de 0,4 mm.'
         when nozzle.original then 'Bico padrão de latão de 0,4 mm.'
         else 'Diâmetro de latão listado no kit oficial compatível com SV06 ACE.'
       end,
       nozzle.source_url, date '2026-11-14', 'published'
from public.printer_models printer
join saved_nozzles nozzle on true
where printer.manufacturer = 'Sovol'
  and printer.model = 'SV06 ACE'
  and printer.variant = 'standard'
  and printer.catalog_status = 'published'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
