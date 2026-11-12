update public.printer_models
set technical_properties = coalesce(technical_properties, '{}'::jsonb)
  || '{"buildVolumeDescription":"Um cabeçote: 325 × 320 × 325 mm · dois cabeçotes: 300 × 320 × 325 mm · área total combinada: 350 × 320 × 325 mm"}'::jsonb
where manufacturer = 'Bambu Lab'
  and model = 'H2D'
  and variant = 'AMS 2 Pro Combo';
