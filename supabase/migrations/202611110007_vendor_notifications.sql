create table public.store_notification_contacts (
  store_id uuid primary key references public.stores (id) on delete cascade,
  email text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and char_length(email) <= 254),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+55[1-9][0-9]{9,10}$'),
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((whatsapp is not null) or not whatsapp_opt_in),
  check (whatsapp_opt_in = (whatsapp_opt_in_at is not null))
);

alter table public.store_notification_contacts enable row level security;
revoke all on public.store_notification_contacts from anon, authenticated;
grant select, insert, update on public.store_notification_contacts to authenticated;

create policy "Makers can manage contacts for their own store"
  on public.store_notification_contacts for all to authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_notification_contacts.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  )
  with check (
    exists (select 1 from public.stores s where s.id = store_notification_contacts.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create function public.bootstrap_store_notification_contacts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_email text;
begin
  select coalesce(
    (select a.contact_email from public.maker_applications a where a.user_id = new.owner_user_id order by a.created_at desc limit 1),
    (select u.email from auth.users u where u.id = new.owner_user_id)
  ) into owner_email;
  if owner_email is not null then
    insert into public.store_notification_contacts (store_id, email)
      values (new.id, owner_email)
      on conflict (store_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.bootstrap_store_notification_contacts() from public;
create trigger bootstrap_store_notification_contacts_after_insert
  after insert on public.stores for each row execute function public.bootstrap_store_notification_contacts();

insert into public.store_notification_contacts (store_id, email)
select s.id, coalesce(
  (select a.contact_email from public.maker_applications a where a.user_id = s.owner_user_id order by a.created_at desc limit 1),
  u.email
)
from public.stores s
join auth.users u on u.id = s.owner_user_id
where coalesce(
  (select a.contact_email from public.maker_applications a where a.user_id = s.owner_user_id order by a.created_at desc limit 1),
  u.email
) is not null
on conflict (store_id) do nothing;

alter table public.product_quote_requests add column maker_read_at timestamptz;
grant update (maker_read_at) on public.product_quote_requests to authenticated;
create policy "Makers can mark requests for their store as read"
  on public.product_quote_requests for update to authenticated
  using (
    exists (select 1 from public.stores s where s.id = product_quote_requests.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  )
  with check (
    exists (select 1 from public.stores s where s.id = product_quote_requests.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_quote_requests'
    ) then
    alter publication supabase_realtime add table public.product_quote_requests;
  end if;
end;
$$;

create table public.store_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.product_quote_requests (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  destination text not null check (char_length(destination) <= 254),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  last_error text check (last_error is null or char_length(last_error) <= 120),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (request_id, channel)
);
create index store_notification_delivery_queue on public.store_notification_deliveries (next_attempt_at, created_at) where status in ('pending', 'sending');

alter table public.store_notification_deliveries enable row level security;
revoke all on public.store_notification_deliveries from anon, authenticated;
grant select on public.store_notification_deliveries to authenticated;
create policy "Makers can read delivery status for their own requests"
  on public.store_notification_deliveries for select to authenticated
  using (
    exists (
      select 1 from public.product_quote_requests q
      join public.stores s on s.id = q.store_id
      where q.id = store_notification_deliveries.request_id and s.owner_user_id = (select auth.uid())
    )
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create function public.enqueue_quote_request_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_data jsonb := jsonb_build_object('product_name', new.product_name, 'quantity', new.quantity);
begin
  insert into public.store_notification_deliveries (request_id, channel, destination, payload)
    select new.id, 'email', c.email, message_data
      from public.store_notification_contacts c where c.store_id = new.store_id
    union all
    select new.id, 'whatsapp', c.whatsapp, message_data
      from public.store_notification_contacts c where c.store_id = new.store_id and c.whatsapp is not null and c.whatsapp_opt_in;
  return new;
end;
$$;

revoke all on function public.enqueue_quote_request_notifications() from public;
create trigger enqueue_quote_request_notifications_after_insert
  after insert on public.product_quote_requests for each row execute function public.enqueue_quote_request_notifications();

create function public.claim_store_notification_deliveries(batch_size integer default 20)
returns table (id uuid, channel text, destination text, payload jsonb, attempts smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  take_count integer := least(greatest(coalesce(batch_size, 20), 1), 50);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  return query
    with claimable as (
      select d.id from public.store_notification_deliveries d
      where d.attempts < 5 and (
        (d.status = 'pending' and d.next_attempt_at <= now())
        or (d.status = 'sending' and d.updated_at < now() - interval '10 minutes')
      )
      order by d.created_at
      for update skip locked
      limit take_count
    ), claimed as (
      update public.store_notification_deliveries d
      set status = 'sending', attempts = d.attempts + 1, updated_at = now()
      from claimable c where d.id = c.id
      returning d.id, d.channel, d.destination, d.payload, d.attempts
    )
    select c.id, c.channel, c.destination, c.payload, c.attempts from claimed c;
end;
$$;

create function public.complete_store_notification_delivery(delivery_id uuid, message_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  update public.store_notification_deliveries d
    set status = 'sent', provider_message_id = left(message_id, 200), sent_at = now(), last_error = null, updated_at = now()
    where d.id = delivery_id and d.status = 'sending';
end;
$$;

create function public.fail_store_notification_delivery(delivery_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  update public.store_notification_deliveries d
    set status = case when d.attempts >= 5 then 'failed' else 'pending' end,
        next_attempt_at = now() + make_interval(mins => least(60, greatest(5, d.attempts * 5))),
        last_error = left(coalesce(reason, 'Delivery failed'), 120), updated_at = now()
    where d.id = delivery_id and d.status = 'sending';
end;
$$;

create function public.defer_store_notification_delivery(delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  update public.store_notification_deliveries d
    set status = 'pending', attempts = greatest(0, d.attempts - 1), next_attempt_at = now() + interval '1 hour',
        last_error = 'Provider not configured', updated_at = now()
    where d.id = delivery_id and d.status = 'sending';
end;
$$;

create function public.retry_store_notification_delivery(delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_notification_deliveries d
    join public.product_quote_requests q on q.id = d.request_id
    join public.stores s on s.id = q.store_id
    where d.id = delivery_id and d.status = 'failed' and s.owner_user_id = (select auth.uid())
  ) or not exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Delivery cannot be retried';
  end if;
  update public.store_notification_deliveries set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
    where id = delivery_id and status = 'failed';
end;
$$;

revoke all on function public.claim_store_notification_deliveries(integer) from public, anon, authenticated;
revoke all on function public.complete_store_notification_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_store_notification_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.defer_store_notification_delivery(uuid) from public, anon, authenticated;
revoke all on function public.retry_store_notification_delivery(uuid) from public;
grant execute on function public.claim_store_notification_deliveries(integer) to service_role;
grant execute on function public.complete_store_notification_delivery(uuid, text) to service_role;
grant execute on function public.fail_store_notification_delivery(uuid, text) to service_role;
grant execute on function public.defer_store_notification_delivery(uuid) to service_role;
grant execute on function public.retry_store_notification_delivery(uuid) to authenticated;
