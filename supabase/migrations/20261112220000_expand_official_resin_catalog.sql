-- Publish only manufacturer-sourced ranges and machine-specific resin settings.
insert into public.material_catalog (
  manufacturer, product, family, process, catalog_status,
  colors, resin_wavelength_nm, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Anycubic', 'Standard Resin V2', 'standard resin', 'resin', 'published',
  '[{"name":"Black","hex":"#212721"},{"name":"White","hex":"#EFF0F1"},{"name":"Beige","hex":"#FCC89B"},{"name":"Grey","hex":"#7E93A7"},{"name":"HD Grey","hex":"#768692"},{"name":"Clear","hex":null},{"name":"Purple","hex":"#825DC7"},{"name":"Blue","hex":"#00A3E0"},{"name":"Translucent Blue","hex":"#077CAB"},{"name":"Translucent Green","hex":"#009A17"},{"name":"Translucent Red","hex":"#D22630"}]'::jsonb,
  405,
  '{
    "wavelengthNm":{"min":365,"max":405},
    "densityGPerCm3":{"min":1.05,"max":1.25},
    "viscosityMpas":{"min":250,"max":350,"temperatureC":25},
    "firstLayerExposureSeconds":{"min":20,"max":40},
    "normalExposureSeconds":{"min":2.5,"max":3},
    "recommendedLayerHeightsMm":[0.05,0.1],
    "printingTemperatureC":{"min":20,"max":50},
    "postCureMinutes":3,
    "postCureWavelengthNm":405,
    "compatibleProcesses":["LCD","DLP"],
    "exposureByPrinter":[
      {"printer":"Photon P1","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":2,"bottomExposureSeconds":20,"bottomLayers":1,"antiAliasingLevel":4,"zLiftDistanceMm":5,"zLiftSpeedMmPerSecond":3,"zRetractSpeedMmPerSecond":3},
      {"printer":"Photon Mono M7","layerHeightMm":0.05,"normalExposureSeconds":2.2,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":4,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M7 Pro","layerHeightMm":0.05,"normalExposureSeconds":1.8,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":3,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M7 Max","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":0.5,"bottomExposureSeconds":30,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M5","layerHeightMm":0.05,"normalExposureSeconds":2.8,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":5,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M5s","layerHeightMm":0.05,"normalExposureSeconds":2.8,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":5,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono M5s Pro","layerHeightMm":0.05,"normalExposureSeconds":3.6,"lightOffSeconds":0.5,"bottomExposureSeconds":30,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono 4","layerHeightMm":0.05,"normalExposureSeconds":2.8,"lightOffSeconds":1,"bottomExposureSeconds":30,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":6,"zLiftSpeedMmPerSecond":4,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono 4K","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":0.5,"bottomExposureSeconds":40,"bottomLayers":6,"antiAliasingLevel":1,"zLiftDistanceMm":6,"zLiftSpeedMmPerSecond":4,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono 4 Ultra","layerHeightMm":0.05,"normalExposureSeconds":2.6,"lightOffSeconds":1,"bottomExposureSeconds":30,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":5,"zLiftSpeedMmPerSecond":8,"zRetractSpeedMmPerSecond":8},
      {"printer":"Photon Mono 2","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":1,"bottomExposureSeconds":25,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":6,"zLiftSpeedMmPerSecond":4,"zRetractSpeedMmPerSecond":6},
      {"printer":"Photon Mono X2","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":0.5,"bottomExposureSeconds":20,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":2,"zRetractSpeedMmPerSecond":3},
      {"printer":"Photon Mono X 6K","layerHeightMm":0.05,"normalExposureSeconds":2,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":6,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":2,"zRetractSpeedMmPerSecond":3},
      {"printer":"Photon Mono X6Ks","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":0.5,"bottomExposureSeconds":20,"bottomLayers":5,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":3,"zRetractSpeedMmPerSecond":4},
      {"printer":"Photon M3 Max","layerHeightMm":0.05,"normalExposureSeconds":3,"lightOffSeconds":2.5,"bottomExposureSeconds":35,"bottomLayers":6,"antiAliasingLevel":1,"zLiftDistanceMm":10,"zLiftSpeedMmPerSecond":2,"zRetractSpeedMmPerSecond":3},
      {"printer":"Photon M3 Premium","layerHeightMm":0.05,"normalExposureSeconds":2.5,"lightOffSeconds":0.5,"bottomExposureSeconds":25,"bottomLayers":2,"antiAliasingLevel":1,"zLiftDistanceMm":8,"zLiftSpeedMmPerSecond":6,"zRetractSpeedMmPerSecond":6}
    ]
  }'::jsonb,
  'https://store.anycubic.com/products/standard-resin-v2',
  'https://cdn.shopify.com/s/files/1/0245/5519/2380/files/ANYCUBIC-TDS-Standard_Resin_V2_5accc729-c5c1-4a95-896b-2074da8de29b.pdf',
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
