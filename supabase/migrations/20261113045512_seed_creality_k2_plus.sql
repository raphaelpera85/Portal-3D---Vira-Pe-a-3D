-- Manufacturer-published K2 Plus specifications; unknown material/nozzle properties stay unset.
insert into public.printer_models (
  manufacturer, model, variant, technology, catalog_status,
  build_volume_x_mm, build_volume_y_mm, build_volume_z_mm, extruder_count,
  filament_diameter_mm, original_nozzle_diameter_mm, nozzle_interface,
  max_nozzle_temperature_c, max_bed_temperature_c, heated_bed, enclosure,
  max_print_speed_mm_s, maximum_power_w, multicolor_system, multicolor_filament_count,
  technical_properties, source_url, documentation_url, verified_at
) values (
  'Creality', 'K2 Plus', 'standard', 'FDM', 'published',
  350, 350, 350, 1,
  1.75, 0.4, null,
  350, 120, true, true,
  600, 1200, 'Creality CFS (até quatro unidades)', 16,
  '{"maxAccelerationMmPerSecondSquared":30000,"maximumChamberTemperatureC":60,"activeChamberHeater":true,"comboDimensionsMm":{"x":495,"y":515,"z":916},"supportedFilaments":["PLA","ABS","PETG","PA-CF","PLA-CF","PET","ASA","PPA-CF"],"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8]}'::jsonb,
  'https://www.creality.com/eu/products/k2-series-3d-printer',
  'https://www.creality.com/eu/products/k2-series-3d-printer', date '2026-11-13'
)
on conflict (manufacturer, model, variant) do update set
  technology = excluded.technology,
  catalog_status = excluded.catalog_status,
  build_volume_x_mm = excluded.build_volume_x_mm,
  build_volume_y_mm = excluded.build_volume_y_mm,
  build_volume_z_mm = excluded.build_volume_z_mm,
  extruder_count = excluded.extruder_count,
  filament_diameter_mm = excluded.filament_diameter_mm,
  original_nozzle_diameter_mm = excluded.original_nozzle_diameter_mm,
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

insert into public.nozzle_catalog (
  manufacturer, model, interface, diameter_mm, original,
  catalog_status, source_url, documentation_url, verified_at
)
select 'Creality', 'K2 Plus nozzle', 'K2 Plus', diameter, diameter = 0.4,
       'published', 'https://www.creality.com/campaigns/k2-series-buying-guide',
       'https://www.creality.com/eu/products/k2-series-3d-printer', date '2026-11-13'
from unnest(array[0.2, 0.4, 0.6, 0.8]::numeric[]) as sizes(diameter)
on conflict (manufacturer, model, interface, diameter_mm) do update set
  original = excluded.original,
  catalog_status = excluded.catalog_status,
  source_url = excluded.source_url,
  documentation_url = excluded.documentation_url,
  verified_at = excluded.verified_at;

insert into public.printer_nozzle_compatibility (
  printer_id, nozzle_id, fit, source_url, verified_at, catalog_status
)
select printer.id, nozzle.id, 'compatible', 'https://www.creality.com/campaigns/k2-series-buying-guide',
       date '2026-11-13', 'published'
from public.printer_models printer
join public.nozzle_catalog nozzle
  on nozzle.manufacturer = 'Creality'
  and nozzle.model = 'K2 Plus nozzle'
  and nozzle.interface = 'K2 Plus'
where printer.manufacturer = 'Creality'
  and printer.model = 'K2 Plus'
  and printer.variant = 'standard'
on conflict (printer_id, nozzle_id) do update set
  fit = excluded.fit,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
