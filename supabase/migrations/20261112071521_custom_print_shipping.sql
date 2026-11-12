create table public.custom_print_deliveries (
  request_id uuid primary key references public.custom_print_requests (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  delivery_recipient_name text not null check (char_length(btrim(delivery_recipient_name)) between 2 and 100),
  delivery_postal_code text not null check (delivery_postal_code ~ '^\d{8}$'),
  delivery_street text not null check (char_length(btrim(delivery_street)) between 2 and 120),
  delivery_number text not null check (char_length(btrim(delivery_number)) between 1 and 20),
  delivery_complement text not null default '' check (char_length(delivery_complement) <= 100),
  delivery_district text not null check (char_length(btrim(delivery_district)) between 2 and 100),
  delivery_city text not null check (char_length(btrim(delivery_city)) between 2 and 100),
  delivery_state_code text not null check (delivery_state_code ~ '^[A-Z]{2}$'),
  delivery_reference text not null default '' check (char_length(delivery_reference) <= 200),
  shipping_quote_status text not null default 'awaiting_quote'
    check (shipping_quote_status in ('awaiting_quote', 'offered', 'accepted', 'declined')),
  shipping_carrier text check (shipping_carrier is null or shipping_carrier in ('correios', 'melhor_envio', 'transportadora')),
  shipping_service text,
  shipping_cost_cents bigint check (shipping_cost_cents is null or shipping_cost_cents between 0 and 100000000),
  shipping_delivery_days smallint check (shipping_delivery_days is null or shipping_delivery_days between 1 and 365),
  shipment_status text not null default 'awaiting_shipment'
    check (shipment_status in ('awaiting_shipment', 'shipped', 'delivered')),
  shipping_tracking_code text,
  shipping_tracking_url text,
  shipping_expected_date date,
  shipping_shipped_at timestamptz,
  shipping_delivered_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (shipping_quote_status in ('awaiting_quote', 'declined') and shipping_carrier is null and shipping_service is null
      and shipping_cost_cents is null and shipping_delivery_days is null)
    or (shipping_quote_status in ('offered', 'accepted') and shipping_carrier is not null and shipping_service is not null
      and char_length(btrim(shipping_service)) between 2 and 120 and shipping_cost_cents is not null
      and shipping_delivery_days is not null)
  ),
  check (
    (shipment_status = 'awaiting_shipment' and shipping_tracking_code is null and shipping_tracking_url is null
      and shipping_expected_date is null and shipping_shipped_at is null and shipping_delivered_at is null)
    or (shipment_status = 'shipped' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is null)
    or (shipment_status = 'delivered' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is not null)
  )
);

alter table public.custom_print_deliveries enable row level security;
revoke all on public.custom_print_deliveries from anon, authenticated;
grant select on public.custom_print_deliveries to authenticated;
create policy "Custom print delivery visible only to buyer and winning store"
  on public.custom_print_deliveries for select to authenticated
  using (public.can_view_custom_print_request(request_id));

alter table public.custom_print_request_events drop constraint custom_print_request_events_event_type_check;
alter table public.custom_print_request_events add constraint custom_print_request_events_event_type_check
  check (event_type in (
    'request_sent', 'proposal_sent', 'proposal_accepted', 'proposal_declined', 'proposal_closed',
    'request_cancelled', 'production_started', 'production_completed', 'delivery_address_selected',
    'shipping_quote_offered', 'shipping_quote_accepted', 'shipping_quote_declined', 'shipment_shipped', 'shipment_delivered'
  ));

create function public.save_custom_print_delivery_address(p_request_id uuid, p_address_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  buyer_key uuid := (select auth.uid());
  request_row public.custom_print_requests%rowtype;
  address_row public.buyer_addresses%rowtype;
  delivery_row public.custom_print_deliveries%rowtype;
begin
  select q.* into request_row from public.custom_print_requests q
    where q.id = p_request_id and q.buyer_id = buyer_key for update;
  if buyer_key is null or not exists (select 1 from public.user_roles r where r.user_id = buyer_key and r.role = 'buyer'::public.app_role)
    or request_row.id is null or request_row.status <> 'accepted' or request_row.production_started_at is not null then
    raise exception using errcode = '42501', message = 'Delivery address cannot be changed';
  end if;
  if exists (select 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id
      and p.status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded', 'charged_back')) then
    raise exception using errcode = '22023', message = 'Payment already started';
  end if;
  select * into address_row from public.buyer_addresses a where a.id = p_address_id and a.buyer_id = buyer_key;
  if not found then raise exception using errcode = '42501', message = 'Delivery address unavailable'; end if;
  select * into delivery_row from public.custom_print_deliveries d where d.request_id = p_request_id for update;
  if found and delivery_row.shipping_quote_status not in ('awaiting_quote', 'declined') then
    raise exception using errcode = '22023', message = 'Shipping quote must be declined before changing the address';
  end if;
  insert into public.custom_print_deliveries (
    request_id, buyer_id, delivery_recipient_name, delivery_postal_code, delivery_street, delivery_number,
    delivery_complement, delivery_district, delivery_city, delivery_state_code, delivery_reference,
    shipping_quote_status, shipping_carrier, shipping_service, shipping_cost_cents, shipping_delivery_days, updated_at
  ) values (
    p_request_id, buyer_key, address_row.recipient_name, address_row.postal_code, address_row.street, address_row.number,
    address_row.complement, address_row.district, address_row.city, address_row.state_code, address_row.reference,
    'awaiting_quote', null, null, null, null, now()
  ) on conflict (request_id) do update set
    delivery_recipient_name = excluded.delivery_recipient_name, delivery_postal_code = excluded.delivery_postal_code,
    delivery_street = excluded.delivery_street, delivery_number = excluded.delivery_number,
    delivery_complement = excluded.delivery_complement, delivery_district = excluded.delivery_district,
    delivery_city = excluded.delivery_city, delivery_state_code = excluded.delivery_state_code,
    delivery_reference = excluded.delivery_reference, shipping_quote_status = 'awaiting_quote',
    shipping_carrier = null, shipping_service = null, shipping_cost_cents = null,
    shipping_delivery_days = null, updated_at = now();
end;
$$;

create function public.set_custom_print_shipping_quote(p_request_id uuid, p_carrier text, p_service text,
  p_shipping_cents bigint, p_delivery_days smallint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  request_row public.custom_print_requests%rowtype;
  delivery_row public.custom_print_deliveries%rowtype;
begin
  select q.* into request_row from public.custom_print_requests q join public.stores s on s.id = q.winning_store_id
    where q.id = p_request_id and s.owner_user_id = (select auth.uid()) for update of q;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or request_row.status <> 'accepted' then
    raise exception using errcode = '42501', message = 'Custom print request unavailable';
  end if;
  select * into delivery_row from public.custom_print_deliveries d where d.request_id = p_request_id for update;
  if not found or delivery_row.shipping_quote_status not in ('awaiting_quote', 'declined')
    or p_carrier is null or p_carrier not in ('correios', 'melhor_envio', 'transportadora')
    or char_length(btrim(coalesce(p_service, ''))) not between 2 and 120
    or p_shipping_cents is null or p_shipping_cents not between 0 and 100000000
    or p_delivery_days is null or p_delivery_days not between 1 and 365
    or exists (select 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id
      and p.status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded', 'charged_back')) then
    raise exception using errcode = '22023', message = 'Shipping quote cannot be changed';
  end if;
  update public.custom_print_deliveries set shipping_quote_status = 'offered', shipping_carrier = p_carrier,
    shipping_service = btrim(p_service), shipping_cost_cents = p_shipping_cents,
    shipping_delivery_days = p_delivery_days, updated_at = now() where request_id = p_request_id;
end;
$$;

create function public.respond_to_custom_print_shipping_quote(p_request_id uuid, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  request_row public.custom_print_requests%rowtype;
  delivery_row public.custom_print_deliveries%rowtype;
begin
  select q.* into request_row from public.custom_print_requests q
    where q.id = p_request_id and q.buyer_id = (select auth.uid()) for update;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or request_row.status <> 'accepted' or p_response is null or p_response not in ('accept', 'decline') then
    raise exception using errcode = '42501', message = 'Shipping quote unavailable';
  end if;
  select * into delivery_row from public.custom_print_deliveries d where d.request_id = p_request_id for update;
  if not found or (p_response = 'accept' and delivery_row.shipping_quote_status <> 'offered')
    or (p_response = 'decline' and delivery_row.shipping_quote_status not in ('offered', 'accepted'))
    or exists (select 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id
      and p.status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded', 'charged_back')) then
    raise exception using errcode = '22023', message = 'Shipping quote cannot be answered';
  end if;
  if p_response = 'accept' then
    update public.custom_print_deliveries set shipping_quote_status = 'accepted', updated_at = now() where request_id = p_request_id;
  else
    update public.custom_print_deliveries set shipping_quote_status = 'declined', shipping_carrier = null,
      shipping_service = null, shipping_cost_cents = null, shipping_delivery_days = null, updated_at = now()
      where request_id = p_request_id;
  end if;
end;
$$;

create function public.mark_custom_print_shipped(p_request_id uuid, p_tracking_code text,
  p_tracking_url text default null, p_expected_date date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype; delivery_row public.custom_print_deliveries%rowtype;
begin
  select q.* into request_row from public.custom_print_requests q join public.stores s on s.id = q.winning_store_id
    where q.id = p_request_id and s.owner_user_id = (select auth.uid()) for update of q;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or request_row.status <> 'completed' or not exists (select 1 from public.seller_order_payments p
      where p.custom_print_request_id = p_request_id and p.status = 'paid') then
    raise exception using errcode = '42501', message = 'Paid completed request required';
  end if;
  select * into delivery_row from public.custom_print_deliveries d where d.request_id = p_request_id for update;
  if not found or delivery_row.shipping_quote_status <> 'accepted' or delivery_row.shipment_status <> 'awaiting_shipment'
    or char_length(btrim(coalesce(p_tracking_code, ''))) not between 1 and 100 or p_tracking_code ~ '[[:cntrl:]]'
    or (p_tracking_url is not null and (char_length(p_tracking_url) > 2048 or p_tracking_url !~ '^https://[A-Za-z0-9.-]+(/[^[:space:]]*)?$'))
    or (p_expected_date is not null and p_expected_date not between current_date and current_date + 365) then
    raise exception using errcode = '22023', message = 'Shipment cannot be marked as sent';
  end if;
  update public.custom_print_deliveries set shipment_status = 'shipped', shipping_tracking_code = btrim(p_tracking_code),
    shipping_tracking_url = p_tracking_url, shipping_expected_date = p_expected_date, shipping_shipped_at = now(), updated_at = now()
    where request_id = p_request_id;
end;
$$;

create function public.confirm_custom_print_delivery(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype; delivery_row public.custom_print_deliveries%rowtype;
begin
  select q.* into request_row from public.custom_print_requests q
    where q.id = p_request_id and q.buyer_id = (select auth.uid()) for update;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or request_row.status <> 'completed' then
    raise exception using errcode = '42501', message = 'Completed request unavailable';
  end if;
  select * into delivery_row from public.custom_print_deliveries d where d.request_id = p_request_id for update;
  if not found or delivery_row.shipment_status <> 'shipped' then
    raise exception using errcode = '22023', message = 'Shipment is not awaiting delivery confirmation';
  end if;
  update public.custom_print_deliveries set shipment_status = 'delivered', shipping_delivered_at = now(), updated_at = now()
    where request_id = p_request_id;
end;
$$;

create function public.log_custom_print_delivery_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_event text;
begin
  if tg_op = 'INSERT' then
    next_event := 'delivery_address_selected';
  elsif old.shipping_quote_status is distinct from new.shipping_quote_status then
    next_event := 'shipping_quote_' || new.shipping_quote_status;
  elsif old.shipment_status is distinct from new.shipment_status then
    next_event := 'shipment_' || new.shipment_status;
  end if;
  if next_event is not null then
    insert into public.custom_print_request_events (target_id, actor_user_id, event_type, event_data)
      select t.id, (select auth.uid()), next_event,
        case when next_event = 'shipping_quote_offered' then jsonb_build_object('carrier', new.shipping_carrier,
          'service', new.shipping_service, 'shipping_cents', new.shipping_cost_cents, 'delivery_days', new.shipping_delivery_days)
          when next_event = 'shipment_shipped' then jsonb_build_object('tracking_code', new.shipping_tracking_code,
            'tracking_url', new.shipping_tracking_url, 'expected_date', new.shipping_expected_date)
          else '{}'::jsonb end
      from public.custom_print_requests q join public.custom_print_request_targets t
        on t.request_id = q.id and t.store_id = q.winning_store_id where q.id = new.request_id;
  end if;
  return new;
end;
$$;
revoke all on function public.log_custom_print_delivery_event() from public, anon, authenticated;
create trigger log_custom_print_delivery_event_after_change
  after insert or update of shipping_quote_status, shipment_status on public.custom_print_deliveries
  for each row execute function public.log_custom_print_delivery_event();

create function public.delete_custom_print_delivery_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'cancelled' and new.status = 'cancelled' then
    delete from public.custom_print_deliveries where request_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.delete_custom_print_delivery_on_cancel() from public, anon, authenticated;
create trigger delete_custom_print_delivery_after_cancel
  after update of status on public.custom_print_requests for each row execute function public.delete_custom_print_delivery_on_cancel();

create function public.create_custom_print_payment(p_request_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint,
  p_expected_shipping_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  request_row public.custom_print_requests%rowtype;
  offer_row public.custom_print_offers%rowtype;
  delivery_row public.custom_print_deliveries%rowtype;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
  subtotal_cents bigint;
  calculated_total bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  select q.* into request_row from public.custom_print_requests q
    where q.id = p_request_id and q.buyer_id = p_buyer_id and q.status = 'accepted' and q.winning_store_id is not null
    for update;
  if not found then raise exception using errcode = '22023', message = 'Accepted custom print request not found'; end if;
  select o.* into offer_row from public.custom_print_offers o
    where o.request_id = request_row.id and o.store_id = request_row.winning_store_id and o.status = 'accepted' for update;
  select d.* into delivery_row from public.custom_print_deliveries d
    where d.request_id = request_row.id and d.shipping_quote_status = 'accepted' for update;
  if not found or not exists (select 1 from public.store_payment_connections c where c.store_id = offer_row.store_id)
    or not exists (select 1 from public.stores s where s.id = offer_row.store_id and s.status = 'published') then
    raise exception using errcode = '22023', message = 'Accepted offer, shipping quote, or seller payment account is unavailable';
  end if;
  select p.* into existing from public.seller_order_payments p
    where p.custom_print_request_id = p_request_id and p.status in ('creating', 'pending') for update;
  if found then
    return query select existing.id, existing.status, existing.total_cents, existing.marketplace_fee_cents,
      existing.provider_order_id, existing.checkout_url, existing.store_id;
    return;
  end if;
  if exists (select 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id
      and p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')) then
    raise exception using errcode = '22023', message = 'Custom print request has already been charged';
  end if;
  subtotal_cents := round(offer_row.total_brl * 100)::bigint;
  calculated_total := subtotal_cents + delivery_row.shipping_cost_cents;
  if subtotal_cents < 1 or calculated_total > 100100000000
    or p_expected_shipping_cents is null or p_expected_shipping_cents <> delivery_row.shipping_cost_cents
    or p_marketplace_fee_cents is null
    or p_marketplace_fee_cents < 0 or p_marketplace_fee_cents >= subtotal_cents then
    raise exception using errcode = '22023', message = 'Invalid payment amount or marketplace fee';
  end if;
  insert into public.seller_order_payments (custom_print_request_id, buyer_id, store_id, total_cents,
    shipping_cents, marketplace_fee_cents)
    values (p_request_id, p_buyer_id, offer_row.store_id, calculated_total,
      delivery_row.shipping_cost_cents, p_marketplace_fee_cents)
    returning id into next_payment_id;
  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;

revoke all on function public.save_custom_print_delivery_address(uuid, uuid),
  public.set_custom_print_shipping_quote(uuid, text, text, bigint, smallint),
  public.respond_to_custom_print_shipping_quote(uuid, text),
  public.mark_custom_print_shipped(uuid, text, text, date), public.confirm_custom_print_delivery(uuid)
  from public, anon, authenticated;
grant execute on function public.save_custom_print_delivery_address(uuid, uuid),
  public.set_custom_print_shipping_quote(uuid, text, text, bigint, smallint),
  public.respond_to_custom_print_shipping_quote(uuid, text),
  public.mark_custom_print_shipped(uuid, text, text, date), public.confirm_custom_print_delivery(uuid)
  to authenticated;
drop function if exists public.create_custom_print_payment(uuid, uuid, bigint);
revoke all on function public.create_custom_print_payment(uuid, uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.create_custom_print_payment(uuid, uuid, bigint, bigint) to service_role;
