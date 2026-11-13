-- Publish the Kobra S1 and Combo with only manufacturer-confirmed values.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  original_nozzle_diameter_mm, nozzle_interface,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Anycubic', 'Kobra S1', 'standard', 'FDM', 'published',
    250, 250, 250, 1,
    0.4, 'Kobra S1 quick-release hotend',
    320, 120, true, true,
    600, null, null,
    '{"recommendedPrintSpeedMmPerSecond":300,"maximumAccelerationMmPerSecondSquared":20000,"supportedMaterials":["PLA","PETG","TPU","ABS","ASA"],"multicolorUpgradeDescription":"ACE Pro vendido separadamente; sistema de 4 ou 8 cores conforme a configuração","ratedPowerByVoltageW":{"100-120V":325,"200-240V":1300}}'::jsonb,
    'https://eu.anycubic.com/products/kobra-s1',
    'https://wiki.anycubic.com/kobra-s1/anycubic_kobra_s1_combo_user_manual-en-v1.3.pdf',
    date '2026-11-13'
  ),
  (
    'Anycubic', 'Kobra S1', 'Combo', 'FDM', 'published',
    250, 250, 250, 1,
    0.4, 'Kobra S1 quick-release hotend',
    320, 120, true, true,
    600, 'ACE Pro', 4,
    '{"recommendedPrintSpeedMmPerSecond":300,"maximumAccelerationMmPerSecondSquared":20000,"supportedMaterials":["PLA","PETG","TPU","ABS","ASA"],"aceProActiveDryingMaxTemperatureC":55,"maximumMulticolorFilaments":8,"eightColorExpansionRequiresAdditionalHardware":true,"tpu95aNotCompatibleWithAcePro":true,"ratedPowerByVoltageW":{"100-120V":325,"200-240V":1300}}'::jsonb,
    'https://eu.anycubic.com/products/anycubic-kobra-s1-combo-3d-printer',
    'https://wiki.anycubic.com/kobra-s1/anycubic_kobra_s1_combo_user_manual-en-v1.3.pdf',
    date '2026-11-13'
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
  manufacturer, model, interface, diameter_mm, body_material, original,
  catalog_status, source_url, documentation_url, verified_at
)
select 'Anycubic', 'Kobra S1 quick-release hotend', 'Kobra S1 quick-release hotend', diameter,
       case when diameter = 0.4 then 'Hardened steel' end, diameter = 0.4, 'published',
       'https://store.anycubic.com/products/hotend-for-fdm-3d-printers',
       'https://wiki.anycubic.com/kobra-s1/anycubic_kobra_s1_combo_user_manual-en-v1.3.pdf', date '2026-11-13'
from unnest(array[0.25, 0.4, 0.6, 0.8]::numeric[]) as sizes(diameter)
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
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Anycubic'
  and nozzle.model = 'Kobra S1 quick-release hotend'
  and nozzle.interface = 'Kobra S1 quick-release hotend'
where printer.manufacturer = 'Anycubic'
  and printer.model = 'Kobra S1'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
