create table public.custom_print_request_events (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.custom_print_request_targets (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in (
    'request_sent', 'proposal_sent', 'proposal_accepted', 'proposal_declined', 'proposal_closed',
    'request_cancelled', 'production_started', 'production_completed'
  )),
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data) = 'object'),
  created_at timestamptz not null default now()
);
create index custom_print_request_events_recent on public.custom_print_request_events (target_id, created_at);

alter table public.custom_print_request_events enable row level security;
revoke all on public.custom_print_request_events from anon, authenticated;
grant select on public.custom_print_request_events to authenticated;
create policy "Request participants read custom print history" on public.custom_print_request_events for select to authenticated
  using (public.can_view_custom_print_target(target_id));

create function public.log_custom_print_target_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.custom_print_request_events (target_id, actor_user_id, event_type, created_at)
    values (new.id, (select auth.uid()), 'request_sent', clock_timestamp());
  return new;
end;
$$;
revoke all on function public.log_custom_print_target_event() from public, anon, authenticated;
create trigger log_custom_print_target_event_after_insert
  after insert on public.custom_print_request_targets
  for each row execute function public.log_custom_print_target_event();

create function public.log_custom_print_offer_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_event_type text;
begin
  if tg_op = 'INSERT' then
    next_event_type := 'proposal_sent';
  elsif old.status is distinct from new.status then
    next_event_type := case new.status
      when 'accepted' then 'proposal_accepted'
      when 'declined' then 'proposal_declined'
      when 'closed' then 'proposal_closed'
      else null
    end;
  end if;
  if next_event_type is not null then
    insert into public.custom_print_request_events (target_id, actor_user_id, event_type, event_data, created_at)
      values (new.target_id, (select auth.uid()), next_event_type,
        jsonb_build_object('total_brl', new.total_brl, 'lead_days', new.lead_days), clock_timestamp());
  end if;
  return new;
end;
$$;
revoke all on function public.log_custom_print_offer_event() from public, anon, authenticated;
create trigger log_custom_print_offer_event_after_change
  after insert or update of status on public.custom_print_offers
  for each row execute function public.log_custom_print_offer_event();

create function public.log_custom_print_request_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_event_type text;
begin
  next_event_type := case new.status
    when 'cancelled' then 'request_cancelled'
    when 'in_production' then 'production_started'
    when 'completed' then 'production_completed'
    else null
  end;
  if next_event_type is not null and old.status is distinct from new.status then
    insert into public.custom_print_request_events (target_id, actor_user_id, event_type, created_at)
      select t.id, (select auth.uid()), next_event_type, clock_timestamp()
      from public.custom_print_request_targets t
      where t.request_id = new.id and (new.status = 'cancelled' or t.store_id = new.winning_store_id);
  end if;
  return new;
end;
$$;
revoke all on function public.log_custom_print_request_event() from public, anon, authenticated;
create trigger log_custom_print_request_event_after_status_change
  after update of status on public.custom_print_requests
  for each row execute function public.log_custom_print_request_event();
