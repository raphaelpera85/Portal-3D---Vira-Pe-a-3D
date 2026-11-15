-- Phrozen Sonic Mighty Revo 16K confirmed 405 nm light source.
update public.printer_models
set technical_properties = coalesce(technical_properties, '{}'::jsonb) || '{"wavelengthNm":405}'::jsonb,
    source_url = 'https://us.phrozen3d.com/products/sonic-mighty-16k-printer',
    verified_at = date '2026-11-15'
where manufacturer = 'Phrozen'
  and model = 'Sonic Mighty Revo 16K'
  and variant = 'standard';
