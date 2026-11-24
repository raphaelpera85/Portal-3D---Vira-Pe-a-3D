insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  extruder_count, filament_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  multicolor_system, technical_properties, documentation_url, source_url, verified_at
)
values
  (
    'Zortrax', 'M300 Dual', 'standard', 'FDM', 'published',
    265, 265, 300, 2, 1.75, 310, 105, true, null,
    'Dupla extrusão LPD Plus · material e suporte',
    '{"technologyName":"LPD Plus","standardNozzleDiameterMm":0.4,"optionalNozzleDiametersMm":[0.6],"supportedMaterials":["Z-ABS","Z-ASA Pro","Z-ESD","Z-FLEX","Z-GLASS","Z-HIPS","Z-NYLON","Z-PETG","Z-PLA","Z-PLA Pro","Z-ULTRAT","BASF Ultrafuse PAHT CF15","BASF Ultrafuse PP GF30","BASF Ultrafuse PET CF15"],"externalFilamentsSupported":true,"platformTypes":["perfurada","vidro"]}'::jsonb,
    'https://zortrax.com/3d-printers/m300-dual/', 'https://zortrax.com/3d-printers/m300-dual/', '2026-11-23'
  ),
  (
    'BCN3D', 'Omega I60', 'standard', 'FDM', 'published',
    450, 300, 450, 2, 1.75, null, 120, true, true,
    'IDEX · dois extrusores independentes',
    '{"architecture":"IDEX","chamberMaximumTemperatureC":70,"airFiltration":"HEPA H13 + carvão ativado","nozzleDiametersMm":[0.4,0.6],"printingModes":["simples","dupla","suporte","duplicação","espelho"],"manufacturerSupportedMaterials":["BCN3D Filaments for Omega","Open Filament Network for Omega","materiais personalizados com licença"]}'::jsonb,
    'https://support.bcn3d.com/hubfs/BCN3D/Knowledge%20base/Omega%20user%20guide/User%20Guide%20-%20BCN3D%20Omega%20I60.pdf',
    'https://support.bcn3d.com/hubfs/BCN3D/Knowledge%20base/Omega%20user%20guide/User%20Guide%20-%20BCN3D%20Omega%20I60.pdf', '2026-11-23'
  ),
  (
    'INTAMSYS', 'FUNMAT PRO 310 NEO', 'standard', 'FDM', 'published',
    null, null, null, 2, null, null, null, true, true,
    'IDEX · dois extrusores independentes',
    '{"architecture":"IDEX","buildVolumeDescription":"305 × 260 × 260 mm (bico único); 260 × 260 × 260 mm (bicos duplos).","singleNozzleBuildVolumeMm":{"x":305,"y":260,"z":260},"dualNozzleBuildVolumeMm":{"x":260,"y":260,"z":260},"chamberMaximumTemperatureC":100,"airFiltration":"HEPA + carvão ativado","manufacturerSupportedMaterials":["ABS","ASA","PA","PC","PETG","PLA","PPS","TPU","PVA","filamentos com fibra de carbono ou vidro"],"manufacturerSpecificationNotes":["O volume útil muda entre configuração de bico único e duplo.","Temperaturas máximas do bico e da mesa, assim como velocidade máxima, não publicadas na página oficial consultada."]}'::jsonb,
    'https://www.intamsys.com/funmat-pro-310/', 'https://www.intamsys.com/funmat-pro-310/', '2026-11-23'
  ),
  (
    'Modix', 'BIG-60', 'GEN4', 'FDM', 'published',
    600, 600, 660, 1, 1.75, null, null, null, null,
    null,
    '{"optionalIdexSecondExtruder":true,"enclosureOptional":true,"headType":"Griffin single extruder","manufacturerSpecificationNotes":["O segundo cabeçote IDEX e o gabinete são opcionais.","Temperaturas máximas do bico e da mesa, assim como velocidade máxima, não publicadas no catálogo oficial consultado."]}'::jsonb,
    'https://www.modix3d.com/_downloads/brochures/Modix-Catalog-Filament-line.pdf', 'https://www.modix3d.com/_downloads/brochures/Modix-Catalog-Filament-line.pdf', '2026-11-23'
  ),
  (
    'Modix', 'BIG-Meter', 'GEN4', 'FDM', 'published',
    980, 1000, 1000, 1, 1.75, null, null, null, true,
    null,
    '{"optionalIdexSecondExtruder":true,"headType":"Griffin single extruder","manufacturerSpecificationNotes":["Gabinete incluído; segundo cabeçote IDEX opcional.","Temperaturas máximas do bico e da mesa, assim como velocidade máxima, não publicadas no catálogo oficial consultado."]}'::jsonb,
    'https://www.modix3d.com/_downloads/brochures/Modix-Catalog-Filament-line.pdf', 'https://www.modix3d.com/_downloads/brochures/Modix-Catalog-Filament-line.pdf', '2026-11-23'
  ),
  (
    'Modix', 'BIG-180X', 'GEN4', 'FDM', 'published',
    1800, 600, 600, 1, 1.75, null, null, null, null,
    null,
    '{"optionalIdexSecondExtruder":true,"headType":"Griffin single extruder","controller":"Duet3D WiFi 32-bit + Duex5","manufacturerSpecificationNotes":["Segundo cabeçote IDEX opcional.","Temperaturas máximas do bico e da mesa, assim como velocidade máxima, não publicadas no catálogo oficial consultado."]}'::jsonb,
    'https://www.modix3d.com/_downloads/brochures/Modix-Catalog-Filament-line.pdf', 'https://www.modix3d.com/_downloads/brochures/Modix-Catalog-Filament-line.pdf', '2026-11-23'
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
  multicolor_system = excluded.multicolor_system,
  technical_properties = excluded.technical_properties,
  documentation_url = excluded.documentation_url,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;
