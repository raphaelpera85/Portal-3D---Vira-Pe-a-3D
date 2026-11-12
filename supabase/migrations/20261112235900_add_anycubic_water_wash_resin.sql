insert into public.material_catalog (
  manufacturer, product, family, process, catalog_status,
  colors, resin_wavelength_nm, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Anycubic', 'Water-Wash Resin 2.0', 'water-washable resin', 'resin', 'published',
  '[{"name":"Gray","hex":"#7E93A7"},{"name":"White","hex":"#EFF0F1"},{"name":"HD Gray","hex":"#768692"},{"name":"Black","hex":"#212721"},{"name":"Clear","hex":null},{"name":"Translucent Green","hex":"#009A17"},{"name":"Translucent Blue","hex":"#077CAB"},{"name":"Cherry Blossom Pink","hex":"#F5DADF"},{"name":"Translucent Red","hex":"#D22630"},{"name":"Translucent Yellow","hex":"#D5BF39"},{"name":"Smoky Black","hex":"#688197"}]'::jsonb,
  405,
  '{
    "wavelengthNm":{"min":365,"max":405},
    "densityGPerCm3":{"min":1.07,"max":1.09},
    "viscosityMpas":{"min":190,"max":230,"temperatureC":25},
    "firstLayerExposureSeconds":{"min":25,"max":40},
    "normalExposureSeconds":{"min":2,"max":2.5},
    "recommendedLayerHeightsMm":[0.05,0.1],
    "printingTemperatureC":{"min":20,"max":50},
    "washingMethods":["water","ethanol","IPA"],
    "washingDurationMinutes":{"min":3},
    "postCureMinutes":3,
    "postCureWavelengthNm":405,
    "wasteDisposal":"Cure completamente a resina e a água de lavagem antes de descartar como resíduo plástico sólido; não descarte água residual no ralo.",
    "safetyNotes":"Use luvas de nitrila e óculos de proteção, mantenha ventilação, seque bem as peças e faça a cura prontamente.",
    "compatibleProcesses":["LCD","DLP"],
    "exposureByPrinter":[
      {"printer":"Photon P1","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":2,"bottomExposureSeconds":30,"bottomLayers":1,"antiAliasingLevel":4,"zLiftDistanceMm":5,"zLiftSpeedMmPerSecond":3,"zRetractSpeedMmPerSecond":3},
      {"printer":"Photon Mono M7","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":1,"bottomExposureSeconds":35,"bottomLayers":4,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M7 Pro","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":4,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M7 Max","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":0.5,"bottomExposureSeconds":30,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M5","layerHeightMm":0.05,"normalExposureSeconds":2.8,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":5,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M5s","layerHeightMm":0.05,"normalExposureSeconds":2.8,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":5,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M5s Pro","layerHeightMm":0.05,"normalExposureSeconds":3.6,"lightOffSeconds":0.5,"bottomExposureSeconds":30,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono 4","layerHeightMm":0.05,"normalExposureSeconds":2.4,"lightOffSeconds":1,"bottomExposureSeconds":30,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":5,"zLiftSpeedMmPerSecond":8,"zRetractSpeedMmPerSecond":8},
      {"printer":"Photon Mono 4K","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":0.5,"bottomExposureSeconds":40,"bottomLayers":6,"antiAliasingLevel":1,"zLiftDistanceMm":6,"zLiftSpeedMmPerSecond":4,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono 4 Ultra","layerHeightMm":0.05,"normalExposureSeconds":3,"lightOffSeconds":1,"bottomExposureSeconds":35,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":6,"zLiftSpeedMmPerSecond":4,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono 2","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":1,"bottomExposureSeconds":25,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":6,"zLiftSpeedMmPerSecond":4,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono X2","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":0.5,"bottomExposureSeconds":20,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":2,"zRetractSpeedMmPerSecond":3},
      {"printer":"Photon Mono X 6K","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":0.5,"bottomExposureSeconds":23,"bottomLayers":6,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":2,"zRetractSpeedMmPerSecond":3},
      {"printer":"Photon Mono X6Ks","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":0.5,"bottomExposureSeconds":20,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":3,"zRetractSpeedMmPerSecond":4},
      {"printer":"Photon M3 Max","layerHeightMm":0.05,"normalExposureSeconds":3,"lightOffSeconds":2,"bottomExposureSeconds":35,"bottomLayers":6,"antiAliasingLevel":1,"zLiftDistanceMm":10,"zLiftSpeedMmPerSecond":2,"zRetractSpeedMmPerSecond":3},
      {"printer":"Photon M3 Premium","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":4,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6}
    ]
  }'::jsonb,
  'https://store.anycubic.com/products/water-wash-resin',
  'https://cdn.shopify.com/s/files/1/0698/1235/5357/files/ANYCUBIC-TDS-Water-Wash_Resin_2.0.pdf?v=1757643560',
  date '2026-11-12'
)
on conflict (manufacturer, product) do update set
  family = excluded.family,
  process = excluded.process,
  catalog_status = excluded.catalog_status,
  density_g_cm3 = excluded.density_g_cm3,
  colors = excluded.colors,
  resin_wavelength_nm = excluded.resin_wavelength_nm,
  resin_exposure_seconds = excluded.resin_exposure_seconds,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
