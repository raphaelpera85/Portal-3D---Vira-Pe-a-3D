update public.printer_models
set technical_properties = technical_properties || jsonb_build_object(
      'compatibilityNotes', 'A Anycubic orienta a não alimentar filamentos flexíveis, como TPU, pelo ACE Pro; use o suporte externo.'
    )
where manufacturer = 'Anycubic' and model = 'Kobra S1' and variant in ('standard', 'Combo');
