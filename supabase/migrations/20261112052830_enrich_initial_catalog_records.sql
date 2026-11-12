update public.material_catalog
set filament_diameter_mm = 1.75,
    density_g_cm3 = 1.24,
    bed_temperature_min_c = 35,
    bed_temperature_max_c = 45,
    colors = '[{"name":"Branco Jade","hex":"#FFFFFF"},{"name":"Verde Bambu","hex":"#00AE42"},{"name":"Vermelho","hex":"#C12E1F"},{"name":"Preto","hex":"#000000"}]'::jsonb,
    abrasive = false,
    multicolor_compatible = true,
    drying_temperature_c = 55,
    drying_hours = 8,
    source_url = 'https://bambulab-us.myshopify.com/products/pla-basic-filament',
    documentation_url = 'https://cdn1.bambulab.com/filament/filament-guide/wksdyyzd8n9/filament-guide-en.pdf',
    verified_at = date '2026-11-12'
where manufacturer = 'Bambu Lab' and product = 'PLA Basic';

update public.material_catalog
set filament_diameter_mm = 1.75,
    density_g_cm3 = 1.25,
    bed_temperature_min_c = 100,
    bed_temperature_max_c = 120,
    colors = '[{"name":"Preto","hex":"#000000"}]'::jsonb,
    requires_enclosure = true,
    abrasive = true,
    multicolor_compatible = false,
    drying_temperature_c = 100,
    drying_hours = 12,
    source_url = 'https://bambulab-us.myshopify.com/products/ppa-cf',
    documentation_url = 'https://cdn1.bambulab.com/filament/filament-guide/wksdyyzd8n9/filament-guide-en.pdf',
    verified_at = date '2026-11-12'
where manufacturer = 'Bambu Lab' and product = 'PPA-CF';
