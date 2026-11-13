insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  filament_diameter_mm, original_nozzle_diameter_mm,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
)
select
  'Bambu Lab', 'P1S', 'Combo', 'FDM', 'published',
  256, 256, 256,
  1.75, 0.4,
  300, 100, true, true,
  1000, 'AMS', 4,
  '{"maxToolheadSpeedMmPerSecond":500,"maxToolheadAccelerationMmPerSecondSquared":20000,"maxHotendFlowMm3PerSecond":32,"maxHotendFlowConditions":"ABS, 150 × 150 mm, parede única, 280 °C","maximumPowerByVoltageW":{"100-120V":350,"220-240V":1000},"supportedMaterials":{"ideal":["PLA","PETG","TPU","ABS","ASA","PVA","PET"],"capable":["PA","PC"],"notRecommended":["carbon/glass fiber reinforced"]},"amsUnitsIncluded":1,"maximumMulticolorFilaments":16}'::jsonb,
  'https://forum.bambulab.com/t/the-bambu-lab-p1s-is-launched/19959',
  'https://cdn1.bambulab.com/documentation/quick-start-0fa3c8ddd3d3f/P1S%20Combo/English%20version-Quick%20Start%20Guide%20for%20P1S-Combo.pdf',
  date '2026-11-13'
on conflict (manufacturer, model, variant) do update set
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
  enclosure = excluded.enclosure,
  maximum_power_w = excluded.maximum_power_w,
  multicolor_system = excluded.multicolor_system,
  multicolor_filament_count = excluded.multicolor_filament_count,
  technical_properties = excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select
  printer.id, nozzle.id, 'compatible', nozzle.source_url, date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Bambu Lab'
  and nozzle.model = 'P1 Series hotend'
  and nozzle.interface = 'P1 Series hotend'
where printer.manufacturer = 'Bambu Lab'
  and printer.model = 'P1S'
  and printer.variant = 'Combo'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
