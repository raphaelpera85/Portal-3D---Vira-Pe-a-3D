-- First source-verified catalog batch. Unknown manufacturer values remain NULL.
with printer as (
  insert into public.printer_models (
    manufacturer, model, variant, technology, catalog_status,
    build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
    filament_diameter_mm, original_nozzle_diameter_mm,
    max_nozzle_temperature_c, max_bed_temperature_c, heated_bed,
    max_print_speed_mm_s, maximum_power_w, multicolor_system,
    multicolor_filament_count, source_url, documentation_url, verified_at
  ) values (
    'Bambu Lab', 'A1 mini', 'Combo', 'FDM', 'published',
    180, 180, 180, 1.75, 0.4, 300, 80, true, 500, 150, 'AMS lite', 4,
    'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf',
    'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf',
    date '2026-11-12'
  ) on conflict (manufacturer, model, variant) do update set
    technology = excluded.technology,
    catalog_status = excluded.catalog_status,
    build_volume_x_mm = excluded.build_volume_x_mm,
    build_volume_y_mm = excluded.build_volume_y_mm,
    build_volume_z_mm = excluded.build_volume_z_mm,
    filament_diameter_mm = excluded.filament_diameter_mm,
    original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
    max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
    max_bed_temperature_c = excluded.max_bed_temperature_c,
    heated_bed = excluded.heated_bed,
    max_print_speed_mm_s = excluded.max_print_speed_mm_s,
    maximum_power_w = excluded.maximum_power_w,
    multicolor_system = excluded.multicolor_system,
    multicolor_filament_count = excluded.multicolor_filament_count,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id
), materials as (
  insert into public.material_catalog (
    manufacturer, product, family, process, catalog_status,
    nozzle_temperature_min_c, nozzle_temperature_max_c,
    drying_required, drying_temperature_c, drying_hours,
    max_print_speed_mm_s, technical_properties,
    source_url, documentation_url, verified_at
  ) values
    (
      'Bambu Lab', 'PLA Basic', 'PLA', 'filament', 'published',
      190, 230, false, 55, 8, 300,
      '{"speed_limit_mm_s":"< 300","drying":"optional; blast drying oven"}'::jsonb,
      'https://cdn1.bambulab.com/filament/filament-guide/wksdyyzd8n9/filament-guide-en.pdf',
      'https://cdn1.bambulab.com/filament/filament-guide/wksdyyzd8n9/filament-guide-en.pdf', date '2026-11-12'
    ),
    (
      'Bambu Lab', 'PPA-CF', 'PPA-CF', 'filament', 'published',
      280, 310, true, 100, 8, 100,
      '{"speed_limit_mm_s":"< 100","drying_temperature_c":{"min":100,"max":140},"drying_hours":{"min":8,"max":12},"drying_method":"blast drying oven"}'::jsonb,
      'https://cdn1.bambulab.com/filament/filament-guide/wksdyyzd8n9/filament-guide-en.pdf',
      'https://cdn1.bambulab.com/filament/filament-guide/wksdyyzd8n9/filament-guide-en.pdf', date '2026-11-12'
    )
  on conflict (manufacturer, product) do update set
    family = excluded.family,
    process = excluded.process,
    catalog_status = excluded.catalog_status,
    nozzle_temperature_min_c = excluded.nozzle_temperature_min_c,
    nozzle_temperature_max_c = excluded.nozzle_temperature_max_c,
    drying_required = excluded.drying_required,
    drying_temperature_c = excluded.drying_temperature_c,
    drying_hours = excluded.drying_hours,
    max_print_speed_mm_s = excluded.max_print_speed_mm_s,
    technical_properties = excluded.technical_properties,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id, product
), nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, body_material,
    original, catalog_status, source_url, documentation_url, verified_at
  ) values
    ('Bambu Lab', 'A1 mini', 'A1 mini hotend', 0.2, null, false, 'published', 'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf', 'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf', date '2026-11-12'),
    ('Bambu Lab', 'A1 mini', 'A1 mini hotend', 0.4, 'Stainless steel', true, 'published', 'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf', 'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf', date '2026-11-12'),
    ('Bambu Lab', 'A1 mini', 'A1 mini hotend', 0.6, null, false, 'published', 'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf', 'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf', date '2026-11-12'),
    ('Bambu Lab', 'A1 mini', 'A1 mini hotend', 0.8, null, false, 'published', 'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf', 'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf', date '2026-11-12')
  on conflict (manufacturer, model, interface, diameter_mm) do update set
    body_material = excluded.body_material,
    original = excluded.original,
    catalog_status = excluded.catalog_status,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id, diameter_mm
)
insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select p.id, m.id,
  case when m.product = 'PLA Basic' then 'compatible' else 'conditional' end,
  case when m.product = 'PPA-CF' then 'O fabricante não recomenda filamentos reforçados com fibra de carbono para a A1 mini; o material pode exigir até 310 °C, acima do limite de 300 °C da impressora.' else null end,
  'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf',
  date '2026-11-12', 'published'
from printer p
cross join materials m
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select p.id, n.id, 'compatible', null,
  'https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf',
  date '2026-11-12', 'published'
from public.printer_models p
cross join public.nozzle_catalog n
where p.manufacturer = 'Bambu Lab' and p.model = 'A1 mini' and p.variant = 'Combo'
  and n.manufacturer = 'Bambu Lab' and n.model = 'A1 mini' and n.interface = 'A1 mini hotend'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
