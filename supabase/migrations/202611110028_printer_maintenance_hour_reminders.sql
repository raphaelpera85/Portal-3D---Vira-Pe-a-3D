alter table public.printer_maintenance_events
  add column next_due_hours numeric(10, 2),
  add constraint printer_maintenance_next_due_hours_check
    check (next_due_hours is null or next_due_hours > coalesce(hours_at_event, 0));

create or replace function public.validate_printer_maintenance_date()
returns trigger language plpgsql set search_path = '' as $$
declare current_hours numeric(10, 2);
begin
  if new.performed_at > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception using errcode = '22023', message = 'Maintenance date cannot be in the future';
  end if;
  if new.next_due_hours is not null then
    select p.accumulated_hours into current_hours from public.maker_printers p where p.id = new.printer_id;
    if current_hours is null or new.next_due_hours <= current_hours then
      raise exception using errcode = '22023', message = 'Next maintenance hours must be above current equipment hours';
    end if;
  end if;
  return new;
end; $$;
