-- Publish manufacturer-recommended Hyper PLA settings without inferring hex colors.
update public.material_catalog as material
set nozzle_temperature_min_c = 190,
    nozzle_temperature_max_c = 230,
    technical_properties = coalesce(technical_properties, '{}'::jsonb) || '{"bedTemperatureMaxC":60,"bedCanBeUnheated":true,"recommendedPrintSpeedMmPerSecond":{"min":40,"max":100},"retractionDistanceMm":0.5,"retractionSpeedMmPerSecond":40}'::jsonb,
    colors = coalesce(material.colors, '[]'::jsonb) || (
      select coalesce(jsonb_agg(candidate.color), '[]'::jsonb)
      from jsonb_array_elements('[{"name":"Gray","hex":null},{"name":"Black","hex":null},{"name":"White","hex":null},{"name":"Blue","hex":null},{"name":"Red","hex":null},{"name":"Brown","hex":null},{"name":"Orange","hex":null},{"name":"Green","hex":null},{"name":"Flesh","hex":null},{"name":"Yellow","hex":null},{"name":"Very Peri","hex":null},{"name":"Viva Magenta","hex":null},{"name":"Peach Fuzz","hex":null},{"name":"Purple","hex":null},{"name":"Gold","hex":null}]'::jsonb) as candidate(color)
      where not exists (
        select 1 from jsonb_array_elements(coalesce(material.colors, '[]'::jsonb)) as existing(color)
        where lower(existing.color->>'name') = lower(candidate.color->>'name')
      )
    ),
    source_url = 'https://store.creality.com/eu/products/hyper-1-75mm-pla-3d-printing-filament-1kg',
    documentation_url = 'https://store.creality.com/eu/blogs/basics/3d-printing-retraction',
    verified_at = date '2026-11-14'
where manufacturer = 'Creality' and product = 'Hyper PLA';
