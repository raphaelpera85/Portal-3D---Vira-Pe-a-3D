-- Bambu Lab confirms the Combo includes an AMS 2 Pro; its four-slot count is not modeled without a direct specification source.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  multicolor_system, technical_properties, source_url, documentation_url, verified_at
) values (
  'Bambu Lab', 'P2S', 'AMS 2 Pro Combo', 'FDM', 'published',
  256, 256, 256,
  300, 110, true, true,
  'AMS 2 Pro',
  '{"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"quickSwapHotend":true,"ams2ProIncluded":true,"amsFilamentDrying":true}'::jsonb,
  'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/',
  'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/',
  date '2026-11-13'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  enclosure = excluded.enclosure,
  multicolor_system = excluded.multicolor_system,
  technical_properties = printer_models.technical_properties || excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select
  p.id, n.id, 'compatible', n.source_url, date '2026-11-13', 'published'
from public.printer_models p
join public.nozzle_catalog n on n.manufacturer = 'Bambu Lab' and n.model = 'P2S hotend' and n.interface = 'P2S quick-swap hotend'
where p.manufacturer = 'Bambu Lab' and p.model = 'P2S' and p.variant = 'AMS 2 Pro Combo'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
