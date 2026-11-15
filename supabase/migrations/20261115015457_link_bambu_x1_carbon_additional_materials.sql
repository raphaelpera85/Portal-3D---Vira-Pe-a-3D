-- Link exact catalog products to X1-Carbon only where the manufacturer lists their material family.
with links(printer_variant, material_product, compatibility, conditions) as (
  values
    ('standard', 'Hyper PLA', 'compatible', 'A ficha da X1-Carbon lista PLA como suportado.'),
    ('AMS Combo', 'Hyper PLA', 'compatible', 'A ficha da X1-Carbon lista PLA como suportado.'),
    ('standard', 'Hyper ABS', 'compatible', 'ABS consta como suportado; imprima com a câmara fechada e siga o perfil do material.'),
    ('AMS Combo', 'Hyper ABS', 'compatible', 'ABS consta como suportado; imprima com a câmara fechada e siga o perfil do material.'),
    ('standard', 'Hyper PETG', 'compatible', 'A ficha da X1-Carbon lista PETG como suportado.'),
    ('AMS Combo', 'Hyper PETG', 'compatible', 'A ficha da X1-Carbon lista PETG como suportado.'),
    ('standard', 'HP ASA', 'compatible', 'ASA consta como suportado; use a câmara fechada e siga o perfil do material.'),
    ('AMS Combo', 'HP ASA', 'compatible', 'ASA consta como suportado; use a câmara fechada e siga o perfil do material.'),
    ('standard', 'HP-TPU', 'compatible', 'TPU consta como suportado; use alimentação direta na variante standard.'),
    ('AMS Combo', 'HP-TPU', 'conditional', 'TPU é suportado pela impressora, mas não use o AMS; alimente diretamente.'),
    ('standard', 'Prusament PLA', 'compatible', 'A ficha da X1-Carbon lista PLA como suportado.'),
    ('AMS Combo', 'Prusament PLA', 'compatible', 'A ficha da X1-Carbon lista PLA como suportado.'),
    ('standard', 'Prusament PETG', 'compatible', 'A ficha da X1-Carbon lista PETG como suportado.'),
    ('AMS Combo', 'Prusament PETG', 'compatible', 'A ficha da X1-Carbon lista PETG como suportado.'),
    ('standard', 'Prusament ASA', 'compatible', 'ASA consta como suportado; use a câmara fechada e siga o perfil do material.'),
    ('AMS Combo', 'Prusament ASA', 'compatible', 'ASA consta como suportado; use a câmara fechada e siga o perfil do material.'),
    ('standard', 'Prusament PA11', 'conditional', 'PA consta como ideal, mas o material pede câmara de 50–60 °C e a X1-Carbon não publica aquecimento ativo nem garantia dessa faixa.'),
    ('AMS Combo', 'Prusament PA11', 'conditional', 'PA consta como ideal, mas o material pede câmara de 50–60 °C e a X1-Carbon não publica aquecimento ativo nem garantia dessa faixa.'),
    ('standard', 'Prusament PA11 Carbon Fiber', 'conditional', 'PA e compósitos de carbono constam como ideais; a X1-Carbon aceita até 300 °C e usa bico endurecido, mas não publica controle ativo de câmara para os 50–60 °C requeridos.'),
    ('AMS Combo', 'Prusament PA11 Carbon Fiber', 'conditional', 'PA e compósitos de carbono constam como ideais; a X1-Carbon aceita até 300 °C e usa bico endurecido, mas não publica controle ativo de câmara para os 50–60 °C requeridos.'),
    ('standard', 'Prusament TPU 95A', 'compatible', 'TPU consta como suportado; use alimentação direta na variante standard.'),
    ('AMS Combo', 'Prusament TPU 95A', 'conditional', 'TPU consta como suportado pela impressora, mas não use o AMS; alimente diretamente.'),
    ('standard', 'Prusament PETG Carbon Fiber', 'compatible', 'Compósitos de carbono constam como ideais e os bicos da X1-Carbon são de aço endurecido.'),
    ('AMS Combo', 'Prusament PETG Carbon Fiber', 'compatible', 'Compósitos de carbono constam como ideais e os bicos da X1-Carbon são de aço endurecido.'),
    ('standard', 'Prusament PC Blend', 'conditional', 'PC consta como ideal, mas a mesa atinge 110 °C em 220 V e 120 °C em 110 V; confirme a tensão e use perfil validado.'),
    ('AMS Combo', 'Prusament PC Blend', 'conditional', 'PC consta como ideal, mas a mesa atinge 110 °C em 220 V e 120 °C em 110 V; confirme a tensão e use perfil validado.')
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
  on material.product = links.material_product
  and material.catalog_status = 'published'
  and material.manufacturer in ('Bambu Lab', 'Creality', 'Prusa Polymers')
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
