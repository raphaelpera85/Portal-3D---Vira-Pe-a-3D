create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  requester_role public.app_role not null,
  category text not null check (category in ('account', 'product', 'order', 'payment', 'delivery', 'technical', 'other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_role public.app_role not null,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index support_tickets_owner_updated on public.support_tickets (user_id, updated_at desc);
create index support_tickets_admin_queue on public.support_tickets (status, updated_at desc) where status in ('open', 'in_progress', 'waiting_user');
create index support_messages_ticket_time on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from anon, authenticated;
grant select on public.support_tickets, public.support_messages to authenticated;

create policy "Ticket owners and admins can read support tickets"
  on public.support_tickets for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
  );

create policy "Ticket participants and admins can read support messages"
  on public.support_messages for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (
        t.user_id = (select auth.uid())
        or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
      )
    )
  );

create function public.create_support_ticket(p_category text, p_subject text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.app_role;
  created_ticket_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select r.role into actor_role from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role in ('buyer'::public.app_role, 'maker'::public.app_role, 'designer'::public.app_role, 'admin'::public.app_role)
    order by case r.role when 'maker'::public.app_role then 1 when 'designer'::public.app_role then 2 when 'buyer'::public.app_role then 3 else 4 end
    limit 1;
  if actor_role is null then raise exception using errcode = '42501', message = 'Portal account required'; end if;
  if p_category is null or p_category not in ('account', 'product', 'order', 'payment', 'delivery', 'technical', 'other')
    or p_subject is null or char_length(btrim(p_subject)) not between 3 and 120
    or p_message is null or char_length(btrim(p_message)) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'Invalid support request';
  end if;

  insert into public.support_tickets (user_id, requester_role, category, subject)
    values ((select auth.uid()), actor_role, p_category, btrim(p_subject)) returning id into created_ticket_id;
  insert into public.support_messages (ticket_id, sender_id, sender_role, body)
    values (created_ticket_id, (select auth.uid()), actor_role, btrim(p_message));
  return created_ticket_id;
end;
$$;

create function public.reply_support_ticket(p_ticket_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_owner uuid;
  ticket_status text;
  actor_role public.app_role;
begin
  if (select auth.uid()) is null or p_ticket_id is null or p_message is null or char_length(btrim(p_message)) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'Invalid support message';
  end if;
  select t.user_id, t.status into ticket_owner, ticket_status from public.support_tickets t where t.id = p_ticket_id for update;
  if not found then raise exception using errcode = '42501', message = 'Support ticket unavailable'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role) then
    actor_role := 'admin'::public.app_role;
  elsif ticket_owner = (select auth.uid()) then
    select r.role into actor_role from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role in ('maker'::public.app_role, 'designer'::public.app_role, 'buyer'::public.app_role)
      order by case r.role when 'maker'::public.app_role then 1 when 'designer'::public.app_role then 2 else 3 end limit 1;
  else
    raise exception using errcode = '42501', message = 'Support ticket unavailable';
  end if;
  if ticket_status = 'closed' or actor_role is null then raise exception using errcode = '22023', message = 'Support ticket is closed'; end if;

  insert into public.support_messages (ticket_id, sender_id, sender_role, body)
    values (p_ticket_id, (select auth.uid()), actor_role, btrim(p_message));
  update public.support_tickets set status = case when actor_role = 'admin'::public.app_role then 'waiting_user' else 'open' end, updated_at = now()
    where id = p_ticket_id;
end;
$$;

create function public.set_support_ticket_status(p_ticket_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  if p_ticket_id is null or p_status is null or p_status not in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed') then
    raise exception using errcode = '22023', message = 'Invalid support status';
  end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_ticket_id;
  if not found then raise exception using errcode = '42501', message = 'Support ticket unavailable'; end if;
end;
$$;

revoke all on function public.create_support_ticket(text, text, text), public.reply_support_ticket(uuid, text), public.set_support_ticket_status(uuid, text) from public, anon;
grant execute on function public.create_support_ticket(text, text, text), public.reply_support_ticket(uuid, text), public.set_support_ticket_status(uuid, text) to authenticated;
