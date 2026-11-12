insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'ELEGOO', 'Centauri Carbon 2', 'standard', 'FDM', 'published',
  256, 256, 256, null, null, null,
  350, 110, true, true,
  null, null, 'ELEGOO CANVAS (vendido separadamente)', null,
  '{"advertisedVelocityMmPerSecond":500,"multicolorUpgrade":"CANVAS"}'::jsonb,
  'https://us.elegoo.com/collections/elegoo-centauri-series/products/centauri-carbon-2-all-in-one-bundle',
  'https://us.elegoo.com/collections/elegoo-centauri-series/products/centauri-carbon-2-all-in-one-bundle',
  date '2026-11-12'
)
on conflict (manufacturer, model, variant) do nothing;
