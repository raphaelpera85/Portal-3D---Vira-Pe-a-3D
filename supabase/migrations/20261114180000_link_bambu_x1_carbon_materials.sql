-- Link only exact Bambu Lab products whose material family is confirmed for X1-Carbon.
with links(printer_variant, material_product, compatibility, conditions) as (
  values
    ('standard', 'PLA Basic', 'compatible', 'A ficha da X1-Carbon lista PLA como suportado.'),
    ('AMS Combo', 'PLA Basic', 'compatible', 'A ficha da X1-Carbon lista PLA como suportado.'),
    ('standard', 'PETG HF', 'compatible', 'A ficha da X1-Carbon lista PETG como suportado.'),
    ('AMS Combo', 'PETG HF', 'compatible', 'A ficha da X1-Carbon lista PETG como suportado.'),
    ('standard', 'PPA-CF', 'conditional', 'PA e compósitos de carbono constam como ideais, mas o perfil do PPA-CF pode exigir até 310 °C; a X1-Carbon chega a 300 °C. Use perfil validado dentro do limite da impressora.'),
    ('AMS Combo', 'PPA-CF', 'conditional', 'PA e compósitos de carbono constam como ideais, mas o perfil do PPA-CF pode exigir até 310 °C; a X1-Carbon chega a 300 °C. Use perfil validado dentro do limite da impressora e alimente diretamente, pois a Bambu não confirma PPA-CF para o AMS.')
)
insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select printer.id, material.id, links.compatibility, links.conditions,
       'https://public-cdn.bambulab.com/store/X1-Carbon%20tech%20specs.pdf',
       date '2026-11-13', 'published'
from links
join public.printer_models printer
  on printer.manufacturer = 'Bambu Lab'
  and printer.model = 'X1-Carbon'
  and printer.variant = links.printer_variant
  and printer.catalog_status = 'published'
join public.material_catalog material
  on material.manufacturer = 'Bambu Lab'
  and material.product = links.material_product
  and material.catalog_status = 'published'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
