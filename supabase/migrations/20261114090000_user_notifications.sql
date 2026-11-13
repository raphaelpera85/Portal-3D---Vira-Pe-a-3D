create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  designer_service_request_id uuid not null references public.designer_service_requests (id) on delete cascade,
  notification_type text not null check (notification_type in ('designer_service_quote', 'designer_service_paid', 'designer_service_started', 'designer_service_completed')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (designer_service_request_id, notification_type)
);

create index user_notifications_unread_recent on public.user_notifications (user_id, created_at desc)
  where read_at is null;
create index user_notifications_recent on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;
create policy "Users can read their own notifications" on public.user_notifications for select to authenticated
  using (user_id = (select auth.uid()));

create function public.notify_designer_service_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  next_type text;
  next_title text;
  next_body text;
begin
  if old.status is not distinct from new.status then return new; end if;
  next_type := case new.status
    when 'quoted' then 'designer_service_quote'
    when 'paid' then 'designer_service_paid'
    when 'in_progress' then 'designer_service_started'
    when 'completed' then 'designer_service_completed'
    else null
  end;
  if next_type is null then return new; end if;

  next_title := case new.status
    when 'quoted' then 'Nova proposta de modelagem'
    when 'paid' then 'Pagamento da modelagem confirmado'
    when 'in_progress' then 'Modelagem iniciada'
    when 'completed' then 'Modelagem concluída'
  end;
  next_body := case new.status
    when 'quoted' then format('O designer enviou uma proposta para "%s".', new.title)
    when 'paid' then format('O pagamento de "%s" foi confirmado.', new.title)
    when 'in_progress' then format('O designer iniciou o trabalho em "%s".', new.title)
    when 'completed' then format('O trabalho de modelagem "%s" foi concluído.', new.title)
  end;
  insert into public.user_notifications (user_id, designer_service_request_id, notification_type, title, body)
    values (new.buyer_id, new.id, next_type, next_title, left(next_body, 500))
    on conflict (designer_service_request_id, notification_type) do nothing;
  return new;
end;
$$;

create trigger notify_designer_service_status_after_update
  after update of status on public.designer_service_requests
  for each row execute function public.notify_designer_service_status();

create function public.mark_user_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or p_notification_id is null then
    raise exception using errcode = '42501', message = 'Invalid notification request';
  end if;
  update public.user_notifications set read_at = coalesce(read_at, now())
    where id = p_notification_id and user_id = (select auth.uid());
end;
$$;

revoke all on function public.notify_designer_service_status(), public.mark_user_notification_read(uuid) from public, anon;
grant execute on function public.mark_user_notification_read(uuid) to authenticated;
