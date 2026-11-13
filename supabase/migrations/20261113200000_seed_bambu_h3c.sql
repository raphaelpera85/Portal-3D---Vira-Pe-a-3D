-- Only specifications explicitly published by Bambu Lab are populated.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm,
  max_nozzle_temperature_c, max_bed_temperature_c,
  heated_bed, enclosure, multicolor_system, technical_properties,
  source_url, documentation_url, verified_at
) values (
  'Bambu Lab', 'H3C', 'AMS 3H Combo', 'FDM', 'published',
  330, 320, 325,
  350, 120,
  true, true, 'SwapTek + AMS 3H',
  '{"activeChamberHeating":true,"maximumChamberTemperatureC":65,"maxToolheadSpeedMmPerSecond":1400,"maxToolheadAccelerationMmPerSecondSquared":25000,"printToolCount":9,"includedAms":"AMS 3H","supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8],"supportedFilamentDiametersMm":[1.75,2.85],"hardenedExtruderGears":true,"includedNozzleMaterial":"hardened steel","airPurificationFilterGrade":"HEPA H11","filamentDrying":true,"externalDimensionsMm":{"x":493,"y":571,"z":587},"weightKgIncludingAms":36.28}'::jsonb,
  'https://blog.bambulab.com/tool-changer-game-changer-bambu-lab-presents-h3c-the-defining-new-generation-of-3d-printers/',
  'https://blog.bambulab.com/tool-changer-game-changer-bambu-lab-presents-h3c-the-defining-new-generation-of-3d-printers/',
  date '2026-11-13'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  max_nozzle_temperature_c = excluded.max_nozzle_temperature_c,
  max_bed_temperature_c = excluded.max_bed_temperature_c,
  heated_bed = excluded.heated_bed,
  enclosure = excluded.enclosure,
  multicolor_system = excluded.multicolor_system,
  technical_properties = printer_models.technical_properties || excluded.technical_properties,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;
