with supported_diameters(diameter_mm) as (
  values (0.20::numeric), (0.40::numeric), (0.60::numeric), (0.80::numeric)
), saved_nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, original, catalog_status,
    technical_properties, source_url, documentation_url, verified_at
  )
  select
    'Bambu Lab', 'P2S hotend', 'P2S quick-swap hotend', diameter_mm, diameter_mm = 0.40, 'published',
    '{}'::jsonb,
    'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/',
    'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/',
    date '2026-11-12'
  from supported_diameters
  on conflict (manufacturer, model, interface, diameter_mm) do update set
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
select
  p.id, n.id, 'compatible', n.source_url, date '2026-11-12', 'published'
from public.printer_models p
join public.nozzle_catalog n on n.manufacturer = 'Bambu Lab' and n.model = 'P2S hotend' and n.interface = 'P2S quick-swap hotend'
join saved_nozzles saved on saved.id = n.id
where p.manufacturer = 'Bambu Lab' and p.model = 'P2S' and p.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
