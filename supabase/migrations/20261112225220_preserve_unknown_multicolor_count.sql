update public.printer_models
set multicolor_system = null,
    technical_properties = technical_properties || '{"multicolorUpgradeDescription":"ELEGOO CANVAS (vendido separadamente)"}'::jsonb
where manufacturer = 'ELEGOO' and model = 'Centauri Carbon 2' and variant = 'standard';
