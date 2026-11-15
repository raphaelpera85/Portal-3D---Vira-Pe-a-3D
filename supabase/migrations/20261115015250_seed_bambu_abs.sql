with saved_material as (
  insert into public.material_catalog (
    manufacturer, product, family, process, catalog_status, filament_diameter_mm,
    nozzle_temperature_min_c, nozzle_temperature_max_c, bed_temperature_min_c, bed_temperature_max_c,
    requires_enclosure, abrasive, multicolor_compatible, drying_required, drying_temperature_c, drying_hours,
    technical_properties, source_url, documentation_url, verified_at
  ) values (
    'Bambu Lab', 'ABS', 'ABS', 'filament', 'published', 1.75,
    240, 280, 90, 100,
    true, false, true, false, 80, 8,
    '{"printSpeedLimit":"< 300 mm/s","amsCompatible":true,"drying":"Optional; 80 °C for 8 hours"}'::jsonb,
    'https://cdn1.bambulab.com/filament/FilamentGuide-EN-2.pdf',
    'https://cdn1.bambulab.com/filament/FilamentGuide-EN-2.pdf', date '2026-11-14'
  ) on conflict (manufacturer, product) do update set
    family = excluded.family,
    process = excluded.process,
    catalog_status = excluded.catalog_status,
    filament_diameter_mm = excluded.filament_diameter_mm,
    nozzle_temperature_min_c = excluded.nozzle_temperature_min_c,
    nozzle_temperature_max_c = excluded.nozzle_temperature_max_c,
    bed_temperature_min_c = excluded.bed_temperature_min_c,
    bed_temperature_max_c = excluded.bed_temperature_max_c,
    requires_enclosure = excluded.requires_enclosure,
    abrasive = excluded.abrasive,
    multicolor_compatible = excluded.multicolor_compatible,
    drying_required = excluded.drying_required,
    drying_temperature_c = excluded.drying_temperature_c,
    drying_hours = excluded.drying_hours,
    technical_properties = excluded.technical_properties,
    source_url = excluded.source_url,
    documentation_url = excluded.documentation_url,
    verified_at = excluded.verified_at
  returning id
)
insert into public.printer_material_compatibility (
  printer_id, material_id, compatibility, conditions, source_url, verified_at, catalog_status
)
select printer.id, material.id, 'compatible',
  'ABS consta como ideal. Use o gabinete fechado e as faixas de temperatura do perfil oficial.',
  case when printer.model = 'X1-Carbon'
    then 'https://public-cdn.bambulab.com/store/X1-Carbon%20tech%20specs.pdf'
    else 'https://cdn1.bambulab.com/documentation/quick-start-59b0cefdc0fc4/P1S/English%20version-Quick%20Start%20Guide%20for%20P1S.pdf'
  end,
  date '2026-11-14', 'published'
from public.printer_models printer
cross join saved_material material
where printer.manufacturer = 'Bambu Lab'
  and ((printer.model = 'X1-Carbon' and printer.variant in ('standard', 'AMS Combo'))
    or (printer.model = 'P1S' and printer.variant in ('standard', 'Combo')))
on conflict (printer_id, material_id) do update set
  compatibility = excluded.compatibility,
  conditions = excluded.conditions,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  catalog_status = excluded.catalog_status;
