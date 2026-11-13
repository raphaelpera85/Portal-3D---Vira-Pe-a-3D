-- Manufacturer specifications keep single- and dual-extruder volumes distinct.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
  max_print_speed_mm_s, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Raise3D', 'Pro3 Plus HS', 'standard', 'FDM', 'published',
  null, null, null, 2, 1.75, 0.4, 320, 120, true, 500,
  '{"buildVolumeDescription":"300 × 300 × 605 mm (extrusão simples) · 255 × 300 × 605 mm (dupla)","singleExtrusionVolumeMm":{"x":300,"y":300,"z":605},"dualExtrusionVolumeMm":{"x":255,"y":300,"z":605}}'::jsonb,
  'https://www.raise3d.com/raise3d-pro3-hs-series/',
  'https://support.raise3d.com/Pro3-HS-Series/raise3d-pro3-hs-series-3d-printer-user-manual-35-1701.html',
  date '2026-11-13'
)
on conflict (manufacturer, model, variant) do nothing;
