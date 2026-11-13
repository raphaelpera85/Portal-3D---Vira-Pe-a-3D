-- Publish source-backed materials and nozzles. Compatibility remains unverified unless a manufacturer states it.
insert into public.material_catalog (
  manufacturer, product, family, process, catalog_status,
  filament_diameter_mm, abrasive, requires_enclosure,
  nozzle_temperature_min_c, nozzle_temperature_max_c,
  bed_temperature_min_c, bed_temperature_max_c, drying_required,
  drying_temperature_c, drying_hours, max_print_speed_mm_s,
  resin_wavelength_nm, resin_exposure_seconds, technical_properties,
  source_url, documentation_url, verified_at
) values
  ('Prusa Polymers', 'Prusament PLA', 'PLA', 'filament', 'published',
   1.75, false, false, 200, 220, 40, 60, null, null, null, null, null, null,
   '{"manufacturerNozzleSettingC":210,"enclosure":"not required"}'::jsonb,
   'https://prusament.com/materials/pla/', 'https://prusament.com/materials/pla/', date '2026-11-12'),
  ('Prusa Polymers', 'Prusament PETG', 'PETG', 'filament', 'published',
   1.75, false, false, 240, 260, 70, 90, null, null, null, null, null, null,
   '{"manufacturerNozzleSettingC":250,"enclosure":"not required"}'::jsonb,
   'https://prusament.com/materials/prusament-petg/', 'https://prusament.com/materials/prusament-petg/', date '2026-11-12'),
  ('Prusa Polymers', 'Prusament ASA', 'ASA', 'filament', 'published',
   1.75, false, null, 255, 265, 105, 115, null, null, null, null, null, null,
   '{"manufacturerNozzleSettingC":260,"enclosure":"recommended, not required"}'::jsonb,
   'https://prusament.com/materials/prusament-asa/', 'https://prusament.com/materials/prusament-asa/', date '2026-11-12'),
  ('Prusa Polymers', 'Prusament PA11', 'PA11', 'filament', 'published',
   1.75, false, true, 265, 285, 90, 110, true, 90, null, null, null, null,
   '{"manufacturerNozzleSettingC":275,"enclosureTemperatureC":{"min":50,"max":60},"dryingHoursRange":{"min":6,"max":8}}'::jsonb,
   'https://prusament.com/materials/prusament-pa11/', 'https://prusament.com/materials/prusament-pa11/', date '2026-11-12'),
  ('Prusa Polymers', 'Prusament PA11 Carbon Fiber', 'PA11-CF', 'filament', 'published',
   1.75, true, null, 275, 295, 100, 120, true, 90, null, null, null, null,
   '{"manufacturerNozzleSettingC":285,"hardenedSteelNozzleRequired":true,"enclosure":"recommended","occasionalDrying":true,"dryingHoursRange":{"min":4,"max":6}}'::jsonb,
   'https://prusament.com/materials/prusament-pa11-nylon-carbon-fiber/', 'https://prusament.com/prusament-pa11-carbon-fiber-black-filament-with-excellent-chemical-and-heat-resistance/', date '2026-11-12'),
  ('ELEGOO', 'ABS-Like Resin V3.0', 'ABS-like resin', 'resin', 'published',
   null, null, null, null, null, null, null, null, null, null, null, 405, null,
   '{"viscosityReductionPercentVsPreviousGenerations":{"min":25,"max":47},"supportedTechnologies":["LCD","MSLA","DLP"]}'::jsonb,
   'https://us.elegoo.com/products/elegoo-abs-like-resin-v-3-0', 'https://us.elegoo.com/products/elegoo-abs-like-resin-v-3-0', date '2026-11-12')
on conflict (manufacturer, product) do update set
  family = excluded.family,
  process = excluded.process,
  catalog_status = excluded.catalog_status,
  filament_diameter_mm = excluded.filament_diameter_mm,
  density_g_cm3 = excluded.density_g_cm3,
  colors = excluded.colors,
  nozzle_temperature_min_c = excluded.nozzle_temperature_min_c,
  nozzle_temperature_max_c = excluded.nozzle_temperature_max_c,
  bed_temperature_min_c = excluded.bed_temperature_min_c,
  bed_temperature_max_c = excluded.bed_temperature_max_c,
  requires_enclosure = excluded.requires_enclosure,
  abrasive = excluded.abrasive,
  multicolor_compatible = excluded.multicolor_compatible,
  drying_required = excluded.drying_required,
  drying_temperature_c = excluded.drying_temperature_c,
  drying_hours = excluded.drying_hours,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  resin_wavelength_nm = excluded.resin_wavelength_nm,
  resin_exposure_seconds = excluded.resin_exposure_seconds,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material,
  max_temperature_c, abrasion_resistant, original, catalog_status,
  technical_properties, source_url, documentation_url, verified_at
) values
  ('Bambu Lab', 'A1 hotend', 'A1 hotend', 0.2, null, null, null, false, 'published', '{}'::jsonb,
   'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1.pdf',
   'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1.pdf', date '2026-11-12'),
  ('Bambu Lab', 'A1 hotend', 'A1 hotend', 0.4, 'Stainless steel', null, null, true, 'published', '{}'::jsonb,
   'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1.pdf',
   'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1.pdf', date '2026-11-12'),
  ('Bambu Lab', 'A1 hotend', 'A1 hotend', 0.6, null, null, null, false, 'published', '{}'::jsonb,
   'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1.pdf',
   'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1.pdf', date '2026-11-12'),
  ('Bambu Lab', 'A1 hotend', 'A1 hotend', 0.8, null, null, null, false, 'published', '{}'::jsonb,
   'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1.pdf',
   'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1.pdf', date '2026-11-12')
on conflict (manufacturer, model, interface, diameter_mm) do update set
  body_material = excluded.body_material,
  max_temperature_c = excluded.max_temperature_c,
  abrasion_resistant = excluded.abrasion_resistant,
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select p.id, n.id, 'compatible', n.source_url, date '2026-11-12', 'published'
from public.printer_models p
cross join public.nozzle_catalog n
where p.manufacturer = 'Bambu Lab' and p.model = 'A1' and p.variant = 'standard'
  and n.manufacturer = 'Bambu Lab' and n.model = 'A1 hotend' and n.interface = 'A1 hotend'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
