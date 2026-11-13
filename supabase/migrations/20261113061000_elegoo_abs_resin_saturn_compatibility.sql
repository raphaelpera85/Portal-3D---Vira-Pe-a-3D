insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select p.id, m.id, 'compatible',
       'O fabricante declara compatibilidade da ABS-Like Resin V3.0 com impressoras LCD da série Saturn. A Saturn 4 Ultra usa LCD/MSLA com UV de 405 nm. Os tempos de exposição específicos não foram preenchidos; consulte e calibre pelo perfil oficial da resina.',
       'https://www.elegoo.com/products/elegoo-abs-like-resin-v-3-0', date '2026-11-13', 'published'
from public.printer_models p
join public.material_catalog m on m.manufacturer = 'ELEGOO' and m.product = 'ABS-Like Resin V3.0'
where p.manufacturer = 'ELEGOO' and p.model = 'Saturn 4 Ultra' and p.variant = '12K'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
