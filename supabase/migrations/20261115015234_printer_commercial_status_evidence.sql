alter table public.printer_models
  add column commercial_status_source_url text,
  add column commercial_status_checked_at date;

-- Older status values have no recorded commercial evidence, so return them to the explicit unknown state.
update public.printer_models
set commercial_status = 'unknown', commercial_status_source_url = null, commercial_status_checked_at = null
where commercial_status <> 'unknown';

alter table public.printer_models
  add constraint printer_models_commercial_status_evidence_check check (
    commercial_status = 'unknown'
    or (commercial_status_source_url like 'https://%' and commercial_status_checked_at is not null)
  );

alter table public.printer_models
  drop constraint printer_models_commercial_status_check,
  add constraint printer_models_commercial_status_check
    check (commercial_status in ('available', 'in_production', 'discontinued', 'announced', 'unknown'));

update public.printer_models
set commercial_status = 'available',
    commercial_status_source_url = 'https://www.sovol3d.com/products/sovol-sv06-ace',
    commercial_status_checked_at = date '2026-11-14'
where manufacturer = 'Sovol' and model = 'SV06 ACE' and variant = 'standard';

update public.printer_models
set commercial_status = 'available',
    commercial_status_source_url = 'https://store.creality.com/products/k2-combo-3d-printer',
    commercial_status_checked_at = date '2026-11-14'
where manufacturer = 'Creality' and model = 'K2' and variant in ('standard', 'CFS Combo');
