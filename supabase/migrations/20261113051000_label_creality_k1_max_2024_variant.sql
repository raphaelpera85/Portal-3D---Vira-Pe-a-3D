-- Keep the model year visible in the catalog variant selector.
update public.printer_models
set variant = '2024'
where manufacturer = 'Creality'
  and model = 'K1 Max'
  and model_year = 2024
  and variant = 'standard';
