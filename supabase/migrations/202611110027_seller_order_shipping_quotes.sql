alter table public.seller_purchase_orders
  add column shipping_quote_status text not null default 'awaiting_quote'
    check (shipping_quote_status in ('awaiting_quote', 'offered', 'accepted', 'declined')),
  add column shipping_carrier text check (shipping_carrier is null or shipping_carrier in ('correios', 'melhor_envio', 'transportadora')),
  add column shipping_service text,
  add column shipping_cost_cents bigint check (shipping_cost_cents is null or shipping_cost_cents >= 0),
  add column shipping_delivery_days smallint,
  add column shipment_status text not null default 'awaiting_shipment'
    check (shipment_status in ('awaiting_shipment', 'shipped', 'delivered', 'completed')),
  add column shipping_tracking_code text,
  add column shipping_tracking_url text,
  add column shipping_expected_date date,
  add column shipping_shipped_at timestamptz,
  add column shipping_delivered_at timestamptz,
  add column completed_at timestamptz,
  add constraint seller_purchase_orders_shipping_quote_check check (
    (shipping_quote_status in ('awaiting_quote', 'declined') and shipping_carrier is null and shipping_service is null
      and shipping_cost_cents is null and shipping_delivery_days is null)
    or (shipping_quote_status in ('offered', 'accepted') and shipping_carrier is not null and shipping_service is not null
      and char_length(btrim(shipping_service)) between 2 and 120 and shipping_cost_cents is not null
      and shipping_cost_cents between 0 and 100000000 and shipping_delivery_days is not null and shipping_delivery_days between 1 and 365)
  ),
  add constraint seller_purchase_orders_shipment_check check (
    (shipment_status = 'awaiting_shipment' and shipping_tracking_code is null and shipping_tracking_url is null
      and shipping_expected_date is null and shipping_shipped_at is null and shipping_delivered_at is null and completed_at is null)
    or (shipment_status = 'shipped' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is null and completed_at is null)
    or (shipment_status = 'delivered' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is not null and completed_at is null)
    or (shipment_status = 'completed' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is not null and completed_at is not null)
  );

alter table public.seller_order_payments add column shipping_cents bigint not null default 0 check (shipping_cents >= 0);

update public.seller_purchase_orders set shipping_quote_status = 'accepted', shipping_carrier = 'transportadora',
  shipping_service = 'Frete combinado diretamente com a loja', shipping_cost_cents = 0, shipping_delivery_days = 1
  where status = 'accepted';

create table public.seller_purchase_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.seller_purchase_orders (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_type text not null check (char_length(event_type) between 2 and 80),
  description text not null check (char_length(description) between 2 and 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index seller_purchase_order_events_recent on public.seller_purchase_order_events (order_id, created_at desc);
alter table public.seller_purchase_order_events enable row level security;
revoke all on public.seller_purchase_order_events from anon, authenticated;
grant select on public.seller_purchase_order_events to authenticated;
create policy "Order participants can read order history" on public.seller_purchase_order_events for select to authenticated
  using (exists (select 1 from public.seller_purchase_orders o where o.id = order_id
    and (o.buyer_id = (select auth.uid()) or exists (select 1 from public.stores s join public.user_roles r
      on r.user_id = s.owner_user_id where s.id = o.store_id and s.owner_user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)));

insert into public.seller_purchase_order_events (order_id, actor_user_id, event_type, description, metadata, created_at)
  select id, buyer_id, 'order_created', 'Pedido criado antes do histórico de eventos.', '{"legacy_import":true}'::jsonb, created_at
  from public.seller_purchase_orders;

create function public.log_seller_purchase_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.seller_purchase_order_events (order_id, actor_user_id, event_type, description)
      values (new.id, new.buyer_id, 'order_created', 'Pedido enviado à loja.');
    return new;
  end if;
  if old.status is distinct from new.status and new.status in ('accepted', 'declined') then
    insert into public.seller_purchase_order_events (order_id, actor_user_id, event_type, description)
      values (new.id, auth.uid(), case new.status when 'accepted' then 'availability_accepted' else 'availability_declined' end,
        case new.status when 'accepted' then 'A loja confirmou a disponibilidade.' else 'A loja recusou o pedido.' end);
  end if;
  if old.shipping_quote_status is distinct from new.shipping_quote_status then
    insert into public.seller_purchase_order_events (order_id, actor_user_id, event_type, description, metadata)
      values (new.id, auth.uid(), 'shipping_quote_' || new.shipping_quote_status,
        case new.shipping_quote_status when 'offered' then 'A loja enviou uma cotação de frete.'
          when 'accepted' then 'O comprador aceitou a cotação de frete.'
          else 'O comprador recusou a cotação de frete.' end,
        jsonb_build_object('carrier', new.shipping_carrier, 'service', new.shipping_service,
          'shipping_cents', new.shipping_cost_cents, 'delivery_days', new.shipping_delivery_days));
  end if;
  if old.shipment_status is distinct from new.shipment_status then
    insert into public.seller_purchase_order_events (order_id, actor_user_id, event_type, description, metadata)
      values (new.id, auth.uid(), 'shipment_' || new.shipment_status,
        case new.shipment_status when 'shipped' then 'A loja marcou o pedido como enviado.'
          when 'delivered' then 'O comprador confirmou o recebimento do pedido.'
          else 'O comprador concluiu o pedido.' end,
        jsonb_build_object('tracking_code', new.shipping_tracking_code, 'tracking_url', new.shipping_tracking_url,
          'expected_date', new.shipping_expected_date, 'changed_at', now()));
  end if;
  return new;
end;
$$;
revoke all on function public.log_seller_purchase_order_event() from public, anon, authenticated;
create trigger log_seller_purchase_order_event_after_change
  after insert or update of status, shipping_quote_status, shipment_status on public.seller_purchase_orders
  for each row execute function public.log_seller_purchase_order_event();

create function public.log_seller_order_payment_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.order_id is not null and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.seller_purchase_order_events (order_id, actor_user_id, event_type, description, metadata)
      values (new.order_id, auth.uid(), 'payment_' || new.status,
        case new.status when 'creating' then 'O checkout foi preparado.' when 'pending' then 'O pagamento está aguardando confirmação.'
          when 'paid' then 'O pagamento foi confirmado.' when 'partially_refunded' then 'O Mercado Pago registrou um reembolso parcial.'
          when 'refunded' then 'O pagamento foi reembolsado.' when 'failed' then 'A tentativa de pagamento falhou.'
          when 'expired' then 'A tentativa de pagamento expirou.' else 'A tentativa de pagamento foi cancelada.' end,
        jsonb_build_object('payment_id', new.id, 'status', new.status, 'total_cents', new.total_cents,
          'shipping_cents', new.shipping_cents, 'marketplace_fee_cents', new.marketplace_fee_cents));
  end if;
  return new;
end;
$$;
revoke all on function public.log_seller_order_payment_event() from public, anon, authenticated;
create trigger log_seller_order_payment_event_after_change
  after insert or update of status on public.seller_order_payments
  for each row execute function public.log_seller_order_payment_event();

create function public.set_seller_order_shipping_quote(p_order_id uuid, p_carrier text, p_service text,
  p_shipping_cents bigint, p_delivery_days smallint)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype;
begin
  select o.* into order_row from public.seller_purchase_orders o
    join public.stores s on s.id = o.store_id
    where o.id = p_order_id and s.owner_user_id = (select auth.uid()) for update of o;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or order_row.status <> 'accepted' or order_row.shipping_quote_status not in ('awaiting_quote', 'declined')
    or p_carrier is null or p_carrier not in ('correios', 'melhor_envio', 'transportadora')
    or char_length(btrim(coalesce(p_service, ''))) not between 2 and 120
    or p_shipping_cents is null or p_shipping_cents not between 0 and 100000000
    or p_delivery_days is null or p_delivery_days not between 1 and 365
    or exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id
      and p.status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded')) then
    raise exception using errcode = '22023', message = 'Shipping quote cannot be changed';
  end if;
  update public.seller_purchase_orders set shipping_quote_status = 'offered', shipping_carrier = p_carrier,
    shipping_service = btrim(p_service), shipping_cost_cents = p_shipping_cents, shipping_delivery_days = p_delivery_days,
    updated_at = now() where id = p_order_id;
end;
$$;

create function public.respond_to_seller_order_shipping_quote(p_order_id uuid, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype;
begin
  select o.* into order_row from public.seller_purchase_orders o where o.id = p_order_id and o.buyer_id = (select auth.uid()) for update;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or order_row.status <> 'accepted' or p_response is null or p_response not in ('accept', 'decline')
    or (p_response = 'accept' and order_row.shipping_quote_status <> 'offered')
    or (p_response = 'decline' and order_row.shipping_quote_status not in ('offered', 'accepted'))
    or exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id
      and p.status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded')) then
    raise exception using errcode = '22023', message = 'Shipping quote is not available';
  end if;
  if p_response = 'accept' then
    update public.seller_purchase_orders set shipping_quote_status = 'accepted', updated_at = now() where id = p_order_id;
  else
    update public.seller_purchase_orders set shipping_quote_status = 'declined', shipping_carrier = null,
      shipping_service = null, shipping_cost_cents = null, shipping_delivery_days = null, updated_at = now() where id = p_order_id;
  end if;
end;
$$;

create function public.mark_seller_purchase_order_shipped(p_order_id uuid, p_tracking_code text,
  p_tracking_url text default null, p_expected_date date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype;
begin
  select o.* into order_row from public.seller_purchase_orders o join public.stores s on s.id = o.store_id
    where o.id = p_order_id and s.owner_user_id = (select auth.uid()) for update of o;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or order_row.status <> 'accepted' or order_row.shipping_quote_status <> 'accepted'
    or order_row.shipment_status <> 'awaiting_shipment' or char_length(btrim(coalesce(p_tracking_code, ''))) not between 1 and 100
    or p_tracking_code ~ '[[:cntrl:]]'
    or (p_tracking_url is not null and (char_length(p_tracking_url) > 2048 or p_tracking_url !~ '^https://[A-Za-z0-9.-]+(/[^[:space:]]*)?$'))
    or (p_expected_date is not null and p_expected_date not between current_date and current_date + 365)
    or not exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id and p.status = 'paid') then
    raise exception using errcode = '22023', message = 'Order cannot be marked as shipped';
  end if;
  update public.seller_purchase_orders set shipment_status = 'shipped', shipping_tracking_code = btrim(p_tracking_code),
    shipping_tracking_url = p_tracking_url, shipping_expected_date = p_expected_date, shipping_shipped_at = now(), updated_at = now()
    where id = p_order_id;
end;
$$;

create function public.confirm_seller_purchase_order_delivery(p_order_id uuid, p_complete boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype;
begin
  select o.* into order_row from public.seller_purchase_orders o where o.id = p_order_id and o.buyer_id = (select auth.uid()) for update;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or (p_complete is null) or (p_complete and order_row.shipment_status <> 'delivered')
    or (not p_complete and order_row.shipment_status <> 'shipped') then
    raise exception using errcode = '42501', message = 'Order delivery cannot be confirmed';
  end if;
  if p_complete then
    update public.seller_purchase_orders set shipment_status = 'completed', completed_at = now(), updated_at = now() where id = p_order_id;
  else
    update public.seller_purchase_orders set shipment_status = 'delivered', shipping_delivered_at = now(), updated_at = now() where id = p_order_id;
  end if;
end;
$$;

create or replace function public.create_seller_order_payment(p_order_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  order_row public.seller_purchase_orders%rowtype;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
  subtotal_cents bigint;
  calculated_total bigint;
  item_row record;
  available_stock integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception using errcode = '42501', message = 'Service role required'; end if;
  select o.* into order_row from public.seller_purchase_orders o where o.id = p_order_id and o.buyer_id = p_buyer_id
    and o.status = 'accepted' and o.shipping_quote_status = 'accepted' for update;
  if not found then raise exception using errcode = '22023', message = 'Accepted order with shipping quote not found'; end if;
  if not exists (select 1 from public.store_payment_connections c where c.store_id = order_row.store_id)
    or not exists (select 1 from public.stores s where s.id = order_row.store_id and s.status = 'published') then
    raise exception using errcode = '22023', message = 'Seller payment account is unavailable';
  end if;
  select p.* into existing from public.seller_order_payments p where p.order_id = p_order_id and p.status in ('creating', 'pending') for update;
  if found then
    return query select existing.id, existing.status, existing.total_cents, existing.marketplace_fee_cents,
      existing.provider_order_id, existing.checkout_url, existing.store_id;
    return;
  end if;
  if exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id and p.status in ('paid', 'partially_refunded')) then
    raise exception using errcode = '22023', message = 'Order has already been paid';
  end if;
  if exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id and p.status = 'refunded') then
    raise exception using errcode = '22023', message = 'Refunded order cannot be charged again';
  end if;
  select sum(round(i.unit_price_brl * 100)::bigint * i.quantity)::bigint into subtotal_cents
    from public.seller_purchase_order_items i where i.order_id = p_order_id;
  calculated_total := subtotal_cents + order_row.shipping_cost_cents;
  if subtotal_cents is null or subtotal_cents < 1 or calculated_total < 1 or p_marketplace_fee_cents is null
    or p_marketplace_fee_cents < 0 or p_marketplace_fee_cents >= subtotal_cents then
    raise exception using errcode = '22023', message = 'Invalid payment amount or marketplace fee';
  end if;
  insert into public.seller_order_payments (order_id, buyer_id, store_id, total_cents, marketplace_fee_cents, shipping_cents)
    values (p_order_id, p_buyer_id, order_row.store_id, calculated_total, p_marketplace_fee_cents, order_row.shipping_cost_cents)
    returning id into next_payment_id;

  perform set_config('virapeca.internal_stock_adjustment', 'on', true);
  for item_row in select i.product_id, sum(i.quantity)::integer as quantity
    from public.seller_purchase_order_items i where i.order_id = p_order_id group by i.product_id order by i.product_id
  loop
    select p.stock_quantity into available_stock from public.marketplace_products p where p.id = item_row.product_id for update;
    if available_stock is not null then
      if available_stock < item_row.quantity then raise exception using errcode = '22023', message = 'Insufficient stock for payment'; end if;
      update public.marketplace_products set stock_quantity = stock_quantity - item_row.quantity, updated_at = now() where id = item_row.product_id;
      insert into public.seller_order_payment_stock_reservations (payment_id, product_id, quantity)
        values (next_payment_id, item_row.product_id, item_row.quantity);
    end if;
  end loop;
  perform set_config('virapeca.internal_stock_adjustment', 'off', true);
  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;

revoke all on function public.set_seller_order_shipping_quote(uuid, text, text, bigint, smallint),
  public.respond_to_seller_order_shipping_quote(uuid, text), public.mark_seller_purchase_order_shipped(uuid, text, text, date),
  public.confirm_seller_purchase_order_delivery(uuid, boolean) from public, anon;
grant execute on function public.set_seller_order_shipping_quote(uuid, text, text, bigint, smallint),
  public.respond_to_seller_order_shipping_quote(uuid, text), public.mark_seller_purchase_order_shipped(uuid, text, text, date),
  public.confirm_seller_purchase_order_delivery(uuid, boolean) to authenticated;
