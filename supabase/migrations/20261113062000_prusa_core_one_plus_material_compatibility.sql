insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select p.id, m.id, profiles.compatibility, profiles.conditions, profiles.source_url,
       date '2026-11-13', 'published'
from (values
  ('Prusament PLA', 'compatible', 'PLA consta na lista de materiais suportados pela CORE One+ Gen 2.', 'https://www.prusa3d.com/p/core-one-plus/'),
  ('Prusament PETG', 'compatible', 'PETG consta na lista de materiais suportados pela CORE One+ Gen 2.', 'https://www.prusa3d.com/p/core-one-plus/'),
  ('Prusament TPU 95A', 'compatible', 'O fabricante oferece perfil para CORE One no PrusaSlicer; se o filamento tiver dificuldade de alimentação, siga o guia e alimente diretamente pelo tubo PTFE.', 'https://help.prusa3d.com/article/prusament-tpu-95a-material-guide_899653'),
  ('Prusament PC Blend', 'compatible', 'PC consta na lista de materiais suportados; a faixa do produto (265–285 °C no bico, 100–120 °C na mesa) cabe nos limites cadastrados da impressora.', 'https://www.prusa3d.com/p/core-one-plus/'),
  ('Prusament ASA', 'conditional', 'ASA é suportado com o sistema opcional Advanced Filtration System.', 'https://www.prusa3d.com/p/core-one-plus/'),
  ('Prusament PETG Carbon Fiber', 'conditional', 'PETG consta na lista de materiais suportados, mas esta variante é abrasiva e exige bico endurecido; confirme o bico selecionado antes de imprimir.', 'https://www.prusa3d.com/p/core-one-plus/'),
  ('Prusament PA11', 'conditional', 'PA requer o Advanced Filtration System. O material requer câmara de 50–60 °C; a CORE One+ atinge até 55 °C, portanto apenas parte da faixa indicada fica disponível.', 'https://www.prusa3d.com/p/core-one-plus/'),
  ('Prusament PA11 Carbon Fiber', 'conditional', 'PA requer o Advanced Filtration System. O material é abrasivo e pede bico endurecido; sua faixa de bico chega a 295 °C, acima do limite de 290 °C da impressora. Use apenas um perfil validado até 290 °C.', 'https://www.prusa3d.com/p/core-one-plus/')
) as profiles(product, compatibility, conditions, source_url)
join public.printer_models p
  on p.manufacturer = 'Prusa Research' and p.model = 'CORE One+' and p.variant = 'Gen 2'
join public.material_catalog m
  on m.manufacturer = 'Prusa Polymers' and m.product = profiles.product
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
