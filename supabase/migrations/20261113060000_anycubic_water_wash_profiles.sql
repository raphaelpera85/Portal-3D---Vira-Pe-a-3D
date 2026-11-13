insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select p.id, m.id, 'compatible', profiles.conditions,
       'https://store.anycubic.com/products/water-wash-resin', date '2026-11-13', 'published'
from (values
  ('Photon P1', 'Camada 0,05 mm; exposição normal 2 s; light-off 2 s; exposição de base 30 s por 1 camada.'),
  ('Photon Mono M7', 'Camada 0,05 mm; exposição normal 2,5 s; light-off 1 s; exposição de base 35 s por 4 camadas.'),
  ('Photon Mono M7 Pro', 'Camada 0,05 mm; exposição normal 2 s; light-off 0,5 s; exposição de base 25 s por 4 camadas.'),
  ('Photon Mono M7 Max', 'Camada 0,05 mm; exposição normal 2 s; light-off 0,5 s; exposição de base 30 s por 5 camadas.')
) as profiles(model, conditions)
join public.printer_models p on p.manufacturer = 'Anycubic' and p.model = profiles.model and p.variant = 'standard'
join public.material_catalog m on m.manufacturer = 'Anycubic' and m.product = 'Water-Wash Resin 2.0'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
