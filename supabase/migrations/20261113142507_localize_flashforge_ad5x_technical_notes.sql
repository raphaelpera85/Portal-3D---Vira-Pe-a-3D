-- Keep the newly displayed manufacturer notes in the portal's pt-BR locale.
update public.printer_models
set technical_properties = jsonb_set(
  jsonb_set(
    technical_properties,
    '{materialNozzleConditions}',
    '{"TPU 95A":"0,4/0,6/0,8 mm; não compatível com IFS","PLA-CF":"Bico de aço endurecido de 0,6 ou 0,8 mm","PETG-CF":"Bico de aço endurecido de 0,6 ou 0,8 mm"}'::jsonb,
    true
  ),
  '{manufacturerSpecificationNotes}',
  '["O manual informa velocidade de impressão de até 300 mm/s e deslocamento de até 600 mm/s.","O manual informa temperatura máxima do extrusor de 300 °C; o conjunto de bico AD5X vendido oficialmente é classificado a 280 °C, valor usado no campo estruturado.","Os 650 W correspondem à potência nominal da fonte, não ao consumo médio ou máximo medido da impressora.","A Flashforge informa que o TPU 95A deve ser impresso em modo de cor única e não é compatível com o IFS."]'::jsonb,
  true
)
where manufacturer = 'Flashforge'
  and model = 'AD5X'
  and technical_properties -> 'materialNozzleConditions' = '{"TPU 95A":"0.4/0.6/0.8 mm; not compatible with IFS","PLA-CF":"0.6 or 0.8 mm hardened steel nozzle","PETG-CF":"0.6 or 0.8 mm hardened steel nozzle"}'::jsonb
  and technical_properties -> 'manufacturerSpecificationNotes' = '["The manual specifies 300 mm/s print speed and 600 mm/s travel speed.","The manual lists 300 C maximum extruder temperature while the AD5X nozzle accessory is rated to 280 C; the structured nozzle maximum follows the accessory rating.","650 W is the power-supply rating, not measured average or maximum printer draw.","TPU 95A must be printed in single-color mode; Flashforge states that it is not compatible with IFS."]'::jsonb;
