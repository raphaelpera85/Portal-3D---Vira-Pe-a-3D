-- UltiMaker S7 supports AA, BB, CC, and DD cores; the S7 ships with two AA 0.4 and one BB 0.4.
update public.printer_models
set nozzle_interface = 'UltiMaker Print Core',
    original_nozzle_diameter_mm = 0.4,
    technical_properties = technical_properties || '{"supportedPrintCores":{"AA":[0.25,0.4,0.8],"BB":[0.4,0.8],"CC":[0.4,0.6],"DD":[0.4]},"includedPrintCores":["AA 0.4 mm","AA 0.4 mm","BB 0.4 mm"]}'::jsonb,
    source_url = 'https://ultimaker.com/3d-printers/s-series/ultimaker-s7/',
    documentation_url = 'https://support.ultimaker.com/articles/Knowledge/000002903',
    verified_at = date '2026-11-15'
where manufacturer = 'Ultimaker' and model = 'S7' and variant = 'standard';

with cores(model, diameter_mm, original) as (
  values
    ('Print Core AA UltiMaker S7'::text, 0.25::numeric, false),
    ('Print Core AA UltiMaker S7', 0.4, true),
    ('Print Core AA UltiMaker S7', 0.8, false),
    ('Print Core BB UltiMaker S7', 0.4, true),
    ('Print Core BB UltiMaker S7', 0.8, false),
    ('Print Core CC UltiMaker S7', 0.4, false),
    ('Print Core CC UltiMaker S7', 0.6, false),
    ('Print Core DD UltiMaker S7', 0.4, false)
)
insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
)
select 'Ultimaker', cores.model, null, cores.diameter_mm, null, null, null, cores.original,
       'published', 'https://support.ultimaker.com/articles/Knowledge/000002903',
       'https://ultimaker.com/3d-printers/s-series/ultimaker-s7/', date '2026-11-15'
from cores
where not exists (
  select 1 from public.nozzle_catalog existing
  where existing.manufacturer = 'Ultimaker'
    and existing.model = cores.model
    and existing.interface is null
    and existing.diameter_mm = cores.diameter_mm
);

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', null, nozzle.source_url, date '2026-11-15', 'published'
from public.nozzle_catalog nozzle
join public.printer_models printer
  on printer.manufacturer = 'Ultimaker'
  and printer.model = 'S7'
  and printer.variant = 'standard'
where nozzle.manufacturer = 'Ultimaker'
  and nozzle.model in (
    'Print Core AA UltiMaker S7', 'Print Core BB UltiMaker S7',
    'Print Core CC UltiMaker S7', 'Print Core DD UltiMaker S7'
  )
  and nozzle.interface is null
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
