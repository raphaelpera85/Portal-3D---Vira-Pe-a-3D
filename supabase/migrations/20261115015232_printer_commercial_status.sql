alter table public.printer_models
  add column commercial_status text not null default 'unknown'
    check (commercial_status in ('in_production', 'discontinued', 'announced', 'unknown'));
