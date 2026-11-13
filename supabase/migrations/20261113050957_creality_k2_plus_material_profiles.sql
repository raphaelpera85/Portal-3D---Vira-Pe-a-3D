-- Exact Creality filaments with K2 Plus profiles from the manufacturer guide.
insert into public.material_catalog (
  manufacturer, product, family, process, catalog_status,
  filament_diameter_mm, requires_enclosure, multicolor_compatible,
  technical_properties, source_url, documentation_url, verified_at
) values
  ('Creality', 'Hyper PLA', 'PLA', 'filament', 'published',
   1.75, null, null, '{}'::jsonb,
   'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide',
   'https://store.creality.com/eu/products/hyper-1-75mm-pla-3d-printing-filament-1kg', date '2026-11-13'),
  ('Creality', 'Hyper ABS', 'ABS', 'filament', 'published',
   1.75, true, null, '{}'::jsonb,
   'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide',
   'https://store.creality.com/eu/products/hyper-abs-3d-printing-filament', date '2026-11-13'),
  ('Creality', 'Hyper PETG', 'PETG', 'filament', 'published',
   1.75, null, null, '{}'::jsonb,
   'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide',
   'https://store.creality.com/eu/products/hyper-petg-filament-1-75mm-1kg', date '2026-11-13'),
  ('Creality', 'HP ASA', 'ASA', 'filament', 'published',
   1.75, true, null, '{}'::jsonb,
   'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide',
   'https://store.creality.com/eu/products/creality-hp-asa', date '2026-11-13'),
  ('Creality', 'HP-TPU', 'TPU', 'filament', 'published',
   1.75, null, false, '{}'::jsonb,
   'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide',
   'https://store.creality.com/de/products/hp-tpu-fdm-3d-drucker-filament-1-75mm-1kg', date '2026-11-13')
on conflict (manufacturer, product) do update set
  family = excluded.family,
  process = excluded.process,
  catalog_status = excluded.catalog_status,
  filament_diameter_mm = excluded.filament_diameter_mm,
  requires_enclosure = excluded.requires_enclosure,
  multicolor_compatible = excluded.multicolor_compatible,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select p.id, m.id, profiles.compatibility, profiles.conditions, profiles.source_url,
       date '2026-11-13', 'published'
from (values
  ('Hyper PLA', 'compatible', 'Perfil Creality Print para K2 Plus: bico 220 °C, mesa 50 °C, câmara 35 °C, velocidade volumétrica máxima 23 mm³/s, flow ratio 0,95.', 'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide'),
  ('Hyper ABS', 'compatible', 'Perfil Creality Print para K2 Plus: bico 260 °C, mesa 80 °C, câmara 50 °C, velocidade volumétrica máxima 23 mm³/s, flow ratio 0,95. Use a impressora totalmente fechada.', 'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide'),
  ('Hyper PETG', 'compatible', 'Perfil Creality Print para K2 Plus: bico 240 °C, mesa 70 °C, câmara 35 °C, velocidade volumétrica máxima 23 mm³/s, flow ratio 0,98.', 'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide'),
  ('HP ASA', 'compatible', 'Perfil Creality Print para K2 Plus: bico 260 °C, mesa 90 °C, câmara 50 °C, velocidade volumétrica máxima 14 mm³/s, flow ratio 0,95. Use a impressora totalmente fechada.', 'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide'),
  ('HP-TPU', 'conditional', 'Perfil Creality Print para K2 Plus: bico 220 °C, mesa 40 °C, câmara 35 °C, velocidade volumétrica máxima 3 mm³/s. Não use CFS; use TPU com dureza mínima 85A e alimente diretamente o extrusor.', 'https://store.creality.com/au/blogs/tutorial/creality-k2-plus-filament-parameter-guide')
) as profiles(product, compatibility, conditions, source_url)
join public.printer_models p
  on p.manufacturer = 'Creality' and p.model = 'K2 Plus' and p.variant = 'standard'
join public.material_catalog m
  on m.manufacturer = 'Creality' and m.product = profiles.product
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
