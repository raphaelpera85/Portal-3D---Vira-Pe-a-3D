insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select
  printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Bambu Lab'
  and nozzle.model = 'P1 Series hotend'
  and nozzle.interface = 'P1 Series hotend'
where printer.manufacturer = 'Bambu Lab'
  and printer.model = 'P1S'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
