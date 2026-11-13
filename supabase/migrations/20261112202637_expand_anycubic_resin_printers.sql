-- Publish resin printers with source-backed dimensions and preserve resin speed units in JSON.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  maximum_power_w, technical_properties, source_url, documentation_url, verified_at
) values
  ('Anycubic', 'Photon Mono M7', 'standard', 'MSLA', 'published', 223, 126, 230, 135,
   '{"lcdResolution":"14K","xyResolutionMicrons":[16.8,24.8],"layerHeightRangeMm":{"min":0.01,"max":0.15},"maximumPrintSpeedMmPerHour":{"standardResinAt0_1mm":90,"highSpeedResinAt0_1mm":150},"lightSource":"COB + Fresnel lens + light uniformity algorithm","lightIntensityMicroWattsPerCm2":{"nominal":4500,"tolerancePercent":10},"resinVatCapacityLiters":1,"leveling":"Leveling-free","resinAutoFill":false,"dynamicVatTemperature":false}'::jsonb,
   'https://store.anycubic.com/products/photon-mono-m7', 'https://store.anycubic.com/products/photon-mono-m7', date '2026-11-12'),
  ('Anycubic', 'Photon Mono M7 Pro', 'standard', 'MSLA', 'published', 223, 126, 230, 240,
   '{"lcdResolution":"14K","xyResolutionMicrons":[16.8,24.8],"layerHeightRangeMm":{"min":0.01,"max":0.15},"maximumPrintSpeedMmPerHour":{"standardResinAt0_1mm":130,"highSpeedResinAt0_1mm":170},"lightSource":"COB + Fresnel lens + light uniformity algorithm","lightIntensityMicroWattsPerCm2":{"nominal":5500,"tolerancePercent":10},"resinVatCapacityLiters":1,"leveling":"Leveling-free","resinAutoFill":true,"dynamicVatTemperature":true}'::jsonb,
   'https://store.anycubic.com/products/photon-mono-m7-pro', 'https://store.anycubic.com/products/photon-mono-m7-pro', date '2026-11-12'),
  ('Anycubic', 'Photon Mono M7 Max', 'standard', 'MSLA', 'published', 298, 164, 300, 180,
   '{"lcdResolution":"7K","xyResolutionMicrons":[46,46],"layerHeightRangeMm":{"min":0.01,"max":0.15},"maximumPrintSpeedMmPerHour":{"standardResinAt0_05mm":31,"standardResinAt0_1mm":63,"highSpeedResinAt0_1mm":86},"lightSource":"COB + Fresnel lens + light uniformity algorithm","lightIntensityMicroWattsPerCm2":{"nominal":4500,"tolerancePercent":10},"resinVatCapacityLiters":1.3,"leveling":"4-point manual leveling","resinAutoFill":true,"dynamicVatTemperature":true}'::jsonb,
   'https://store.anycubic.com/products/photon-mono-m7-max', 'https://store.anycubic.com/products/photon-mono-m7-max', date '2026-11-12'),
  ('Anycubic', 'Photon P1', 'standard', 'MSLA', 'published', 223, 126, 230, 215,
   '{"lcdResolution":"14K","xyResolutionMicrons":[16.8,24.8],"layerHeightRangeMm":{"min":0.02,"max":0.15},"standardResinPrintSpeedMmPerHour":{"min":25,"max":35,"layerHeightMm":0.05},"lightSource":"COB + Fresnel + mask","lightIntensityMicroWattsPerCm2":5000,"resinVatCapacityLiters":1,"leveling":"Auto-Leveling 3.0 with feedback","dynamicVatTemperature":true,"dualColorOrMaterialKit":"Optional two resin tanks and build plates"}'::jsonb,
   'https://store.anycubic.com/products/photon-p1-resin-3d-printer', 'https://store.anycubic.com/products/photon-p1-resin-3d-printer', date '2026-11-12')
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  maximum_power_w = excluded.maximum_power_w,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select p.id, m.id, 'compatible', 'O fabricante lista resina standard para este modelo; ajustar exposição ao perfil publicado.',
       m.source_url, date '2026-11-12', 'published'
from public.printer_models p
join public.material_catalog m on m.manufacturer = 'Anycubic' and m.product = 'Standard Resin V2'
where p.manufacturer = 'Anycubic'
  and p.model in ('Photon Mono M7', 'Photon Mono M7 Pro', 'Photon Mono M7 Max', 'Photon P1')
  and p.variant = 'standard'
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
