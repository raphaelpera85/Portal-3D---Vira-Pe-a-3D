insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  extruder_count, filament_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, multicolor_system, multicolor_filament_count,
  technical_properties, documentation_url, source_url, verified_at
)
values
  (
    'MINGDA', 'MD-400D+', 'standard', 'FDM', 'published',
    400, 400, 400, 2, 1.75, 350, 110, true, true,
    300, 'IDEX · dois extrusores independentes', 2,
    '{"architecture":"IDEX","chamberMaximumTemperatureC":45,"recommendedPrintSpeedMmPerSecond":200,"maxAccelerationMmPerSecondSquared":10000,"maxVolumetricFlowRateMm3PerSecond":40,"standardNozzleDiameterMm":0.4,"optionalNozzleDiametersMm":[0.6,0.8],"toolheadModes":[{"mode":"copy","dimensionsMm":{"x":200,"y":400,"z":400}},{"mode":"mirror","dimensionsMm":{"x":160,"y":400,"z":400}}],"manufacturerSupportedMaterials":["PLA","TPU","PETG","PETG-CF","ABS-GF","PET-CF/GF","PA12-CF","PPS","PVA","S-Multi","S-HtPA"],"manufacturerSpecificationNotes":["A velocidade máxima de impressão anunciada é 300 mm/s; o fabricante destaca 200 mm/s como alta velocidade de impressão.","O volume em modo cópia e espelho é menor que o volume de um único cabeçote."]}'::jsonb,
    'https://www.3dmingda.com/md400d', 'https://www.3dmingda.com/md400d', '2026-11-23'
  ),
  (
    'TRONXY', 'VEHO 1000-16', '2E · duas cores', 'FDM', 'published',
    1000, 1000, 1600, 2, null, 275, 100, true, null,
    150, 'Cabeçote 2-in-1-out · troca de dois filamentos', 2,
    '{"nozzleDiameterMm":0.6,"printSpeedRecommendedMmPerSecond":60,"manufacturerSupportedMaterials":["PLA","ABS","PETG","PA","WOOD"],"manufacturerSpecificationNotes":["A loja oficial anuncia 20–150 mm/s como faixa de velocidade e 60 mm/s como recomendação.","A página não especifica diâmetro do filamento."]}'::jsonb,
    'https://store.tronxy.com/product/?id=8000020', 'https://store.tronxy.com/product/?id=8000020', '2026-11-23'
  ),
  (
    'CreatBot', 'D600 Pro3 HS', 'standard', 'FDM', 'published',
    null, null, null, 2, 1.75, 420, 120, true, true,
    600, 'Dois extrusores com elevação automática', 2,
    '{"singleNozzleBuildVolumeMm":{"x":620,"y":620,"z":620},"dualNozzleBuildVolumeMm":{"x":565,"y":620,"z":620},"chamberMaximumTemperatureC":80,"maxVolumetricFlowRateMm3PerSecond":90,"standardNozzleDiameterMm":0.6,"supportedNozzleDiametersMm":[0.3,0.4,0.6,0.8,1],"airFiltration":"HEPA + carvão ativado","manufacturerSupportedMaterials":["PLA","ABS","ASA","PETG","PC","Nylon","TPU","ABS-CF","PC-CF","PET-CF","PET-GF","UltraPA-CF","PPS-CF"],"manufacturerSpecificationNotes":["O volume útil muda entre extrusão simples e dupla.","Temperatura de bico e mesa vem do manual oficial; velocidade de 600 mm/s é a máxima indicada na página atual do produto."]}'::jsonb,
    'https://www.creatbot.com/downloads/D600%20pro3%20HS%20User%20Manual.pdf', 'https://creatbot.com/d600-pro3-hs/', '2026-11-23'
  ),
  (
    'CreatBot', 'D1000 Pro HS', 'standard', 'FDM', 'published',
    1050, 1050, 1050, 2, 1.75, null, null, null, null,
    600, 'Dois extrusores com elevação independente', 2,
    '{"printHeadSystem":"Dual-gear lifting extruder","manufacturerSpecificationNotes":["A tabela oficial confirma dois bicos e velocidade máxima de 600 mm/s; temperaturas máximas de bico e mesa não aparecem na tabela consultada."]}'::jsonb,
    'https://www.creatbot.com/comparison/', 'https://www.creatbot.com/comparison/', '2026-11-23'
  ),
  (
    'CreatBot', 'D1200 Ultra', 'standard', 'FDM', 'published',
    1200, 1050, 1050, 2, 1.75, null, null, null, null,
    1100, 'IDEX · dois cabeçotes independentes', 2,
    '{"architecture":"IDEX","printHeadSystem":"IDEX","manufacturerSpecificationNotes":["A comparação oficial lista IDEX, dois bicos e velocidade máxima de 1100 mm/s; temperaturas máximas de bico e mesa não aparecem na tabela consultada."]}'::jsonb,
    'https://www.creatbot.com/comparison/', 'https://www.creatbot.com/comparison/', '2026-11-23'
  ),
  (
    'Flashforge', 'Creator 5', 'standard', 'FDM', 'published',
    256, 256, 256, 4, null, 320, 120, true, false,
    300, 'Quatro cabeçotes independentes · toolchanger', 4,
    '{"maxTravelSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":30000,"maxVolumetricFlowRateMm3PerSecond":32,"standardNozzleDiameterMm":0.4,"supportedNozzleDiametersMm":[0.25,0.4,0.6,0.8],"motionSystem":"CoreXY","manufacturerSupportedMaterials":["PLA","PETG","TPU 90A","TPU 95A","TPU 64D","PLA-CF","PETG-CF","SILK","PVA","BVOH"],"manufacturerSpecificationNotes":["Estrutura aberta; ABS e materiais de engenharia são listados pelo fabricante com gabinete.","Quatro cabeçotes independentes."]}'::jsonb,
    'https://eu.flashforge.com/en-eu/products/flashforge-creator-5', 'https://eu.flashforge.com/en-eu/products/flashforge-creator-5', '2026-11-23'
  ),
  (
    'Flashforge', 'Creator 5 Pro', 'standard', 'FDM', 'published',
    256, 256, 256, 4, null, 320, 120, true, true,
    300, 'Quatro cabeçotes independentes · toolchanger', 4,
    '{"maxTravelSpeedMmPerSecond":600,"maxAccelerationMmPerSecondSquared":30000,"maxVolumetricFlowRateMm3PerSecond":32,"standardNozzleDiameterMm":0.4,"chamberMaximumTemperatureC":65,"airFiltration":"HEPA H13 + carvão de coco","manufacturerSupportedMaterials":["PLA","PETG","TPU","PLA-CF","PETG-CF","ABS","ASA","PA-CF","PET-CF","PAHT-CF","PPA-CF","PC","PPS-CF"],"manufacturerSpecificationNotes":["Câmara com aquecimento até 65 °C e quatro cabeçotes independentes."]}'::jsonb,
    'https://eu.flashforge.com/en-eu/products/flashforge-creator-5-pro', 'https://eu.flashforge.com/en-eu/products/flashforge-creator-5-pro', '2026-11-23'
  )
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  filament_diameter_mm = excluded.filament_diameter_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  enclosure = excluded.enclosure,
  max_print_speed_mm_s = excluded.max_print_speed_mm_s,
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  documentation_url = excluded.documentation_url,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;

update public.printer_models
set multicolor_system = 'IDEX opcional · segundo cabeçote vendido separadamente',
    multicolor_filament_count = 2,
    verified_at = '2026-11-23'
where manufacturer = 'Modix'
  and (model, variant) in (('BIG-60', 'GEN4'), ('BIG-Meter', 'GEN4'), ('BIG-180X', 'GEN4'));
