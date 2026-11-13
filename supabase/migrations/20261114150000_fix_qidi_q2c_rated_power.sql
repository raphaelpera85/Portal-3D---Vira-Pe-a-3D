-- Keep the Q2C's rated power out of the field reserved for maximum power draw.
update public.printer_models
set maximum_power_w = null,
    technical_properties = coalesce(technical_properties, '{}'::jsonb) || '{"ratedPowerWatts":350}'::jsonb
where manufacturer = 'QIDI Tech'
  and model = 'Q2C'
  and variant in ('standard', 'QIDI Box Combo');
