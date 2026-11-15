-- Add only the FLSUN T1 Pro specifications confirmed on its official product page.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  max_print_speed_mm_s, technical_properties, source_url, verified_at
) values (
  'FLSUN', 'T1 Pro', 'standard', 'FDM', 'published',
  null, null, null, 1000,
  '{"buildVolumeDescription":"Cilíndrico · Ø260 × 330 mm","buildVolumeShape":"cylindrical","buildDiameterMm":260,"buildHeightMm":330,"maximumSpeedDescription":"Até 1.000 mm/s, velocidade máxima anunciada pelo fabricante"}'::jsonb,
  'https://eu.store.flsun3d.com/products/flsun-t1-pro-3d-printer-free-silk-filament-included', date '2026-11-14'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;
