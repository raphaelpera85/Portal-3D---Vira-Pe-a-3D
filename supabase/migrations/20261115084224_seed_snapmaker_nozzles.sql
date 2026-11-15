-- Record only manufacturer-listed nozzle diameters and materials for the two Snapmaker printers.
with sources(model, diameter_mm, body_material, original, source_url, conditions) as (
  values
    ('Bico Snapmaker U1'::text, 0.4::numeric, 'Aço inoxidável'::text, true, 'https://www.snapmaker.com/en/snapmaker-u1/specs'::text, 'Bico padrão documentado pela Snapmaker.'::text),
    ('Bico Snapmaker Artisan', 0.2, null, false, 'https://www.snapmaker.com/en/snapmaker-artisan/specs/', 'Diâmetro opcional listado pela Snapmaker; material não especificado.'),
    ('Bico Snapmaker Artisan', 0.4, 'Latão', true, 'https://www.snapmaker.com/en/snapmaker-artisan/specs/', 'Bico padrão de latão; material dos demais diâmetros não especificado.'),
    ('Bico Snapmaker Artisan', 0.6, null, false, 'https://www.snapmaker.com/en/snapmaker-artisan/specs/', 'Diâmetro opcional listado pela Snapmaker; material não especificado.'),
    ('Bico Snapmaker Artisan', 0.8, null, false, 'https://www.snapmaker.com/en/snapmaker-artisan/specs/', 'Diâmetro opcional listado pela Snapmaker; material não especificado.')
)
insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
  abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
)
select 'Snapmaker', source.model, null, source.diameter_mm, source.body_material, 300,
       null, source.original, 'published', source.source_url, source.source_url, date '2026-11-15'
from sources source
where not exists (
  select 1 from public.nozzle_catalog existing
  where existing.manufacturer = 'Snapmaker'
    and existing.model = source.model
    and existing.interface is null
    and existing.diameter_mm = source.diameter_mm
);

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible',
       case when nozzle.model = 'Bico Snapmaker Artisan' and nozzle.diameter_mm <> 0.4
         then 'Diâmetro opcional listado pela Snapmaker; material não especificado.'
         when nozzle.model = 'Bico Snapmaker Artisan' then 'Bico padrão de latão. Escolha o modo de bico na verificação do volume.'
         else 'Bico padrão de aço inoxidável documentado pela Snapmaker.' end,
       nozzle.source_url, date '2026-11-15', 'published'
from public.nozzle_catalog nozzle
join public.printer_models printer
  on printer.manufacturer = 'Snapmaker'
  and printer.model = case nozzle.model when 'Bico Snapmaker U1' then 'U1' else 'Artisan' end
  and printer.variant = 'standard'
where nozzle.manufacturer = 'Snapmaker'
  and nozzle.model in ('Bico Snapmaker U1', 'Bico Snapmaker Artisan')
  and nozzle.interface is null
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
