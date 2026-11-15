-- Sovol M1D technical data from its official product page; mode-specific volumes stay explicit.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status, commercial_status,
  commercial_status_source_url, commercial_status_checked_at,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, filament_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values
  (
    'Sovol', 'M1D', 'Essential', 'FDM', 'published', 'announced',
    'https://www.sovol3d.com/products/sovol-m1d-3d-printer', date '2026-11-14',
    null, null, null, 1.75, 300, 100, true, false,
    600, null, 'DualX tool-changing', 7,
    '{"maxAccelerationMmPerSecondSquared":10000,"maxVolumetricFlowRateMm3PerSecond":30,"toolheadCount":7,"toolheadModes":[{"mode":"fixed toolhead or right-side toolhead switching","dimensionsMm":{"x":300,"y":300,"z":350}},{"mode":"seven-toolhead printing","dimensionsMm":{"x":240,"y":300,"z":350}},{"mode":"copy","dimensionsMm":{"x":178,"y":300,"z":350},"simultaneousParts":2},{"mode":"mirror","dimensionsMm":{"x":138,"y":300,"z":350},"simultaneousParts":2}],"manufacturerSupportedMaterials":["PLA","PETG","TPU","PVA"],"activeChamberHeatingIncluded":false,"buildVolumeDescription":"Varia conforme o modo; selecione uma configuração para verificar o encaixe.","manufacturerSpecificationNotes":["Volumes por modo: ferramenta fixa ou troca lateral 300 × 300 × 350 mm; sete ferramentas 240 × 300 × 350 mm; cópia 178 × 300 × 350 mm por peça; espelho 138 × 300 × 350 mm por peça. Confira o modo antes de validar o encaixe.","A potência publicada refere-se ao aquecimento adaptativo AC; consumo médio não informado."]}'::jsonb,
    'https://www.sovol3d.com/products/sovol-m1d-3d-printer', 'https://www.sovol3d.com/products/sovol-m1d-3d-printer', date '2026-11-14'
  ),
  (
    'Sovol', 'M1D', 'Advanced', 'FDM', 'published', 'announced',
    'https://www.sovol3d.com/products/sovol-m1d-3d-printer', date '2026-11-14',
    null, null, null, 1.75, 300, 100, true, true,
    600, null, 'DualX tool-changing', 7,
    '{"maxAccelerationMmPerSecondSquared":10000,"maxVolumetricFlowRateMm3PerSecond":30,"toolheadCount":7,"toolheadModes":[{"mode":"fixed toolhead or right-side toolhead switching","dimensionsMm":{"x":300,"y":300,"z":350}},{"mode":"seven-toolhead printing","dimensionsMm":{"x":240,"y":300,"z":350}},{"mode":"copy","dimensionsMm":{"x":178,"y":300,"z":350},"simultaneousParts":2},{"mode":"mirror","dimensionsMm":{"x":138,"y":300,"z":350},"simultaneousParts":2}],"manufacturerSupportedMaterials":["PLA","PETG","TPU","PVA","ABS","ASA","PA","PC"],"activeChamberMaximumTemperatureC":60,"activeChamberHeatingIncluded":true,"buildVolumeDescription":"Varia conforme o modo; selecione uma configuração para verificar o encaixe.","manufacturerSpecificationNotes":["Volumes por modo: ferramenta fixa ou troca lateral 300 × 300 × 350 mm; sete ferramentas 240 × 300 × 350 mm; cópia 178 × 300 × 350 mm por peça; espelho 138 × 300 × 350 mm por peça. Confira o modo antes de validar o encaixe.","O aquecimento ativo da câmara até 60 °C está incluído apenas na versão Advanced.","A potência publicada refere-se ao aquecimento adaptativo AC; consumo médio não informado."]}'::jsonb,
    'https://www.sovol3d.com/products/sovol-m1d-3d-printer', 'https://www.sovol3d.com/products/sovol-m1d-3d-printer', date '2026-11-14'
  )
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  commercial_status = excluded.commercial_status,
  commercial_status_source_url = excluded.commercial_status_source_url,
  commercial_status_checked_at = excluded.commercial_status_checked_at,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  filament_diameter_mm = excluded.filament_diameter_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  enclosure = excluded.enclosure,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  maximum_power_w = excluded.maximum_power_w,
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

with supported_nozzles(diameter_mm, body_material, abrasion_resistant, original) as (
  values
    (0.4::numeric, 'Hardened steel', true, true),
    (0.6::numeric, null::text, null::boolean, false),
    (0.8::numeric, null::text, null::boolean, false)
), saved_nozzles as (
  insert into public.nozzle_catalog (
    manufacturer, model, interface, diameter_mm, body_material, max_temperature_c,
    abrasion_resistant, original, catalog_status, source_url, documentation_url, verified_at
  )
  select 'Sovol', 'M1D nozzle', 'Sovol M1D', diameter_mm, body_material, 300,
         abrasion_resistant, original, 'published',
         'https://www.sovol3d.com/products/sovol-m1d-3d-printer',
         'https://www.sovol3d.com/products/sovol-m1d-3d-printer', date '2026-11-14'
  from supported_nozzles
  on conflict (manufacturer, model, interface, diameter_mm) do update set
    body_material = excluded.body_material,
    max_temperature_c = excluded.max_temperature_c,
    abrasion_resistant = excluded.abrasion_resistant,
    original = excluded.original,
    catalog_status = excluded.catalog_status,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id, diameter_mm
)
insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, conditions, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible',
       case when nozzle.diameter_mm = 0.4 then 'Bico padrão de aço endurecido.'
            else 'Diâmetro opcional listado pela Sovol; material não especificado.' end,
       'https://www.sovol3d.com/products/sovol-m1d-3d-printer', date '2026-11-14', 'published'
from public.printer_models printer
cross join saved_nozzles nozzle
where printer.manufacturer = 'Sovol'
  and printer.model = 'M1D'
  and printer.variant in ('Essential', 'Advanced')
  and printer.catalog_status = 'published'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
