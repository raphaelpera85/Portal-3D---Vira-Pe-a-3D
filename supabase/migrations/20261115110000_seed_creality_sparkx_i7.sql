-- Rated power remains a voltage-specific note, not measured printer consumption.
with printer_seed as (
  insert into public.printer_models (
    manufacturer, model, variant, technology, catalog_status,
    build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
    filament_diameter_mm, original_nozzle_diameter_mm,
    max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
    max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
    technical_properties, source_url, documentation_url, verified_at
  ) values
    (
      'Creality', 'SPARKX i7', 'standard', 'FDM', 'published',
      260, 260, 255, 1, 1.75, 0.4,
      300, 100, true, false,
      500, null, 'CFS Lite ou CFS nano (vendidos separadamente)', null,
      '{"maxAccelerationMmPerSecondSquared":10000,"extruder":"Direct drive","supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"ratedPowerWattsByVoltage":{"110V":400,"220V":700},"wifi":"2.4 GHz","aiCameraResolution":"720p"}'::jsonb,
      'https://store.creality.com/products/sparkx-i7-3d-printer',
      'https://store.creality.com/eu/blogs/news/creality-sparkx-i7-combo-new-arrival', date '2026-11-14'
    ),
    (
      'Creality', 'SPARKX i7', 'CFS Lite Color Combo', 'FDM', 'published',
      260, 260, 255, 1, 1.75, 0.4,
      300, 100, true, false,
      500, null, 'CFS Lite', 4,
      '{"maxAccelerationMmPerSecondSquared":10000,"extruder":"Direct drive","supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"ratedPowerWattsByVoltage":{"110V":400,"220V":700},"cfsLiteIncluded":true,"cfsLiteSlots":4,"cfsLiteSupportsMulticolor":true}'::jsonb,
      'https://store.creality.com/products/sparkx-i7-3d-printer',
      'https://store.creality.com/eu/blogs/news/creality-sparkx-i7-combo-new-arrival', date '2026-11-14'
    ),
    (
      'Creality', 'SPARKX i7', 'CFS Mini AutoFill', 'FDM', 'published',
      260, 260, 255, 1, 1.75, 0.4,
      300, 100, true, false,
      500, null, null, null,
      '{"maxAccelerationMmPerSecondSquared":10000,"extruder":"Direct drive","supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"ratedPowerWattsByVoltage":{"110V":400,"220V":700},"includedFilamentSystem":"CFS Mini","cfsMiniSlots":2,"cfsMiniSupportsMulticolor":false,"automaticFilamentRefill":true}'::jsonb,
      'https://store.creality.com/products/sparkx-i7-3d-printer',
      'https://store.creality.com/eu/blogs/news/creality-sparkx-i7-combo-new-arrival', date '2026-11-14'
    ),
    (
      'Creality', 'SPARKX i7', 'CFS nano Combo', 'FDM', 'published',
      260, 260, 255, 1, 1.75, 0.4,
      300, 100, true, false,
      500, null, 'CFS nano', 4,
      '{"maxAccelerationMmPerSecondSquared":10000,"extruder":"Direct drive","supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"ratedPowerWattsByVoltage":{"110V":400,"220V":700},"cfsNanoIncluded":true,"cfsNanoSlots":4,"cfsNanoSupportsMulticolor":true}'::jsonb,
      'https://store.creality.com/products/sparkx-i7-3d-printer',
      'https://store.creality.com/eu/blogs/news/creality-sparkx-i7-combo-new-arrival', date '2026-11-14'
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
    verified_at = excluded.verified_at
  returning id
),
supported_diameters(diameter_mm) as (
  values (0.20::numeric), (0.40::numeric), (0.60::numeric), (0.80::numeric)
), saved_nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
    abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
  )
  select 'Creality', 'SPARKX i7 hotend', 'SPARKX i7', diameter_mm, 'Hardened steel', 300,
         true, diameter_mm = 0.40, 'published',
         'https://store.creality.com/products/sparkx-i7-3d-printer',
         'https://store.creality.com/blogs/tutorial/sparkx-i7-faqs', date '2026-11-14'
  from supported_diameters
  on conflict (manufacturer, model, interface, diameter_mm) do update set
    body_material = excluded.body_material,
    max_temperature_c = excluded.max_temperature_c,
    abrasion_resistant = excluded.abrasion_resistant,
    original = excluded.original,
    catalog_status = excluded.catalog_status,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id
)
insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-14', 'published'
from public.printer_models printer
join printer_seed seeded_printer on seeded_printer.id = printer.id
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Creality'
  and nozzle.model = 'SPARKX i7 hotend'
  and nozzle.interface = 'SPARKX i7'
join saved_nozzles saved on saved.id = nozzle.id
where printer.manufacturer = 'Creality'
  and printer.model = 'SPARKX i7'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
