create table public.admin_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  previous_value text not null,
  new_value text not null,
  created_at timestamptz not null default clock_timestamp()
);

create index admin_audit_events_recent on public.admin_audit_events (created_at desc);

alter table public.admin_audit_events enable row level security;
revoke all on public.admin_audit_events from public, anon, authenticated;
grant select on public.admin_audit_events to authenticated;

create policy "Admins can read audit events" on public.admin_audit_events for select to authenticated
  using (exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role
  ));

create function public.audit_admin_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous_value text;
  new_value text;
begin
  previous_value := to_jsonb(old) ->> tg_argv[0];
  new_value := to_jsonb(new) ->> tg_argv[0];
  if previous_value is not distinct from new_value
    or (select auth.uid()) is null
    or not exists (
      select 1 from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role
    ) then
    return new;
  end if;

  insert into public.admin_audit_events (actor_user_id, entity_type, entity_id, field_name, previous_value, new_value)
  values ((select auth.uid()), tg_table_name, (to_jsonb(new) ->> 'id')::uuid, tg_argv[0], previous_value, new_value);
  return new;
end;
$$;

revoke all on function public.audit_admin_status_change() from public, anon, authenticated;

do $$
declare
  item record;
begin
  for item in select * from (values
    ('catalog_update_history', 'status'),
    ('designer_profiles', 'status'),
    ('digital_asset_reports', 'status'),
    ('maker_applications', 'status'),
    ('maker_print_profiles', 'review_status'),
    ('marketplace_products', 'catalog_status'),
    ('marketplace_reviews', 'status'),
    ('printer_model_suggestions', 'status'),
    ('stores', 'status'),
    ('support_tickets', 'status')
  ) as targets(table_name, field_name)
  loop
    execute format(
      'create trigger audit_admin_status_change after update of %I on public.%I for each row execute function public.audit_admin_status_change(%L)',
      item.field_name, item.table_name, item.field_name
    );
  end loop;
end;
$$;
