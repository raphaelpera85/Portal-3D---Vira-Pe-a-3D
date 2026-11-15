alter table public.printer_maintenance_events
  drop constraint printer_maintenance_events_maintenance_type_check,
  add constraint printer_maintenance_events_maintenance_type_check check (
    maintenance_type in ('preventive', 'corrective', 'nozzle_replacement', 'belt_replacement', 'lubrication', 'bed_replacement', 'component_replacement', 'other')
  );
