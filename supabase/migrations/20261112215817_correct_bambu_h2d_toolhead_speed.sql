-- The specification is toolhead travel speed, not a guaranteed print speed.
update public.printer_models
set max_print_speed_mm_s = null,
    technical_properties = coalesce(technical_properties, '{}'::jsonb)
      || '{"maxToolheadSpeedMmPerSecond":1000}'::jsonb
where manufacturer = 'Bambu Lab'
  and model = 'H2D'
  and variant = 'AMS 2 Pro Combo';
