update public.printer_models
set technical_properties = jsonb_set(
  technical_properties,
  '{materialNozzleConditions,TPU}',
  '"0.6 or 0.8 mm nozzle (recommended)"'::jsonb
)
where manufacturer = 'Flashforge'
  and model = 'Adventurer 5M Pro'
  and variant = 'standard'
  and technical_properties #>> '{materialNozzleConditions,TPU}' = '0.4 mm nozzle (recommended)';
