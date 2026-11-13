-- H2C specifications published by Bambu Lab; unknown values remain null.
with printer as (
  insert into public.printer_models (
    manufacturer, model, variant, technology, catalog_status,
    build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
    max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
    max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
    technical_properties, source_url, documentation_url, verified_at
  ) values (
    'Bambu Lab', 'H2C', 'standard', 'FDM', 'published',
    305, 320, 325, 2,
    350, 120, true, true,
    null, null, 'Vortek (até 7 cores; expansão por AMS até 24 filamentos)', 7,
    '{"activeChamberHeating":true,"activeChamberMaximumTemperatureC":65,"singleNozzleBuildVolumeMm":{"x":305,"y":320,"z":325},"dualNozzleBuildVolumeMm":{"x":300,"y":320,"z":325},"combinedNozzleBuildVolumeMm":{"x":330,"y":320,"z":325},"interchangeableHotends":6,"maxMulticolorFilamentsWithAms":24,"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8]}'::jsonb,
    'https://blog.bambulab.com/bambu-lab-h2c-where-multi-material-vortek-system-meets-engineering-precision/',
    'https://blog.bambulab.com/bambu-lab-h2c-where-multi-material-vortek-system-meets-engineering-precision/',
    date '2026-11-13'
  ) on conflict (manufacturer, model, variant) do update set
    technology = excluded.technology,
    catalog_status = excluded.catalog_status,
    build_volume_x_mm = excluded.build_volume_x_mm,
    build_volume_y_mm = excluded.build_volume_y_mm,
    build_volume_z_mm = excluded.build_volume_z_mm,
    extruder_count = excluded.extruder_count,
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
    original, catalog_status, technical_properties, source_url, documentation_url, verified_at
  )
  select 'Bambu Lab', 'H2C Vortek hotend', 'H2C Vortek hotend', diameter_mm,
         350, diameter_mm = 0.40, 'published', '{}'::jsonb,
         'https://blog.bambulab.com/bambu-lab-h2c-where-multi-material-vortek-system-meets-engineering-precision/',
         'https://blog.bambulab.com/bambu-lab-h2c-where-multi-material-vortek-system-meets-engineering-precision/',
         date '2026-11-13'
  from supported_diameters
  on conflict (manufacturer, model, interface, diameter_mm) do update set
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
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-13', 'published'
from printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Bambu Lab'
  and nozzle.model = 'H2C Vortek hotend'
  and nozzle.interface = 'H2C Vortek hotend'
join saved_nozzles saved on saved.id = nozzle.id
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
