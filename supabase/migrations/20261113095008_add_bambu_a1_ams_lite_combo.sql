insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Bambu Lab', 'A1', 'Combo', 'FDM', 'published',
  256, 256, 256, 1, 1.75, 0.4,
  300, 100, true, null,
  null, null, 'AMS lite', 4,
  '{"optionalNozzleDiametersMm":[0.2,0.6,0.8],"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"maxToolheadSpeedMmPerSecond":500,"maxAccelerationMmPerSecondSquared":10000}'::jsonb,
  'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1%20Combo.pdf',
  'https://cdn1.bambulab.com/documentation/quick-start-a75adcb1d5d5e/Quick%20Start%20Guide%20for%20A1%20Combo.pdf',
  date '2026-11-13'
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

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select combo.id, compatibility.nozzle_id, compatibility.fit, compatibility.conditions,
  combo.source_url, date '2026-11-13', 'published'
from public.printer_models combo
join public.printer_models standard on standard.manufacturer = combo.manufacturer
  and standard.model = combo.model and standard.variant = 'standard'
join public.printer_nozzle_compatibility compatibility on compatibility.printer_id = standard.id
where combo.manufacturer = 'Bambu Lab' and combo.model = 'A1' and combo.variant = 'Combo'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
