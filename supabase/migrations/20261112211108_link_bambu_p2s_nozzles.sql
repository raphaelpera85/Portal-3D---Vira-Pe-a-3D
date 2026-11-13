insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select
  p.id, n.id, 'compatible', n.source_url, date '2026-11-12', 'published'
from public.printer_models p
join public.nozzle_catalog n on n.manufacturer = 'Bambu Lab' and n.model = 'P2S hotend' and n.interface = 'P2S quick-swap hotend'
where p.manufacturer = 'Bambu Lab' and p.model = 'P2S' and p.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
