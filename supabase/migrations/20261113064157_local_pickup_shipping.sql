alter table public.seller_purchase_orders
  drop constraint seller_purchase_orders_shipping_carrier_check,
  add constraint seller_purchase_orders_shipping_carrier_check
    check (shipping_carrier is null or shipping_carrier in ('correios', 'melhor_envio', 'transportadora', 'retirada_local')),
  drop constraint seller_purchase_orders_shipping_quote_check,
  add constraint seller_purchase_orders_shipping_quote_check check (
    (shipping_quote_status in ('awaiting_quote', 'declined') and shipping_carrier is null and shipping_service is null
      and shipping_cost_cents is null and shipping_delivery_days is null)
    or (shipping_quote_status in ('offered', 'accepted') and shipping_carrier is not null and shipping_service is not null
      and char_length(btrim(shipping_service)) between 2 and 120 and shipping_cost_cents is not null
      and shipping_cost_cents between 0 and 100000000 and shipping_delivery_days is not null
      and ((shipping_carrier = 'retirada_local' and shipping_cost_cents = 0 and shipping_delivery_days = 0)
        or (shipping_carrier <> 'retirada_local' and shipping_delivery_days between 1 and 365)))
  ),
  drop constraint seller_purchase_orders_shipment_check,
  add constraint seller_purchase_orders_shipment_check check (
    (shipment_status = 'awaiting_shipment' and shipping_tracking_code is null and shipping_tracking_url is null
      and shipping_expected_date is null and shipping_shipped_at is null and shipping_delivered_at is null and completed_at is null)
    or (shipment_status = 'ready_for_pickup' and shipping_carrier = 'retirada_local' and shipping_tracking_code is null
      and shipping_tracking_url is null and shipping_expected_date is null and shipping_shipped_at is not null
      and shipping_delivered_at is null and completed_at is null)
    or (shipment_status = 'shipped' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is null and completed_at is null)
    or (shipment_status = 'delivered' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is not null and completed_at is null)
    or (shipment_status = 'completed' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is not null and completed_at is not null)
  ),
  drop constraint seller_purchase_orders_shipment_status_check,
  add constraint seller_purchase_orders_shipment_status_check
    check (shipment_status in ('awaiting_shipment', 'ready_for_pickup', 'shipped', 'delivered', 'completed'));

alter table public.custom_print_deliveries
  drop constraint custom_print_deliveries_shipping_carrier_check,
  add constraint custom_print_deliveries_shipping_carrier_check
    check (shipping_carrier is null or shipping_carrier in ('correios', 'melhor_envio', 'transportadora', 'retirada_local')),
  drop constraint custom_print_deliveries_shipping_delivery_days_check,
  add constraint custom_print_deliveries_shipping_delivery_days_check
    check (shipping_delivery_days is null or shipping_delivery_days between 0 and 365),
  drop constraint custom_print_deliveries_check,
  add constraint custom_print_deliveries_check check (
    (shipping_quote_status in ('awaiting_quote', 'declined') and shipping_carrier is null and shipping_service is null
      and shipping_cost_cents is null and shipping_delivery_days is null)
    or (shipping_quote_status in ('offered', 'accepted') and shipping_carrier is not null and shipping_service is not null
      and char_length(btrim(shipping_service)) between 2 and 120 and shipping_cost_cents is not null
      and shipping_cost_cents between 0 and 100000000 and shipping_delivery_days is not null
      and ((shipping_carrier = 'retirada_local' and shipping_cost_cents = 0 and shipping_delivery_days = 0)
        or (shipping_carrier <> 'retirada_local' and shipping_delivery_days between 1 and 365)))
  ),
  drop constraint custom_print_deliveries_check1,
  add constraint custom_print_deliveries_check1 check (
    (shipment_status = 'awaiting_shipment' and shipping_tracking_code is null and shipping_tracking_url is null
      and shipping_expected_date is null and shipping_shipped_at is null and shipping_delivered_at is null)
    or (shipment_status = 'ready_for_pickup' and shipping_carrier = 'retirada_local' and shipping_tracking_code is null
      and shipping_tracking_url is null and shipping_expected_date is null and shipping_shipped_at is not null
      and shipping_delivered_at is null)
    or (shipment_status = 'shipped' and shipping_tracking_code is not null and shipping_shipped_at is not null and shipping_delivered_at is null)
    or (shipment_status = 'delivered' and shipping_tracking_code is not null and shipping_shipped_at is not null and shipping_delivered_at is not null)
  ),
  drop constraint custom_print_deliveries_shipment_status_check,
  add constraint custom_print_deliveries_shipment_status_check
    check (shipment_status in ('awaiting_shipment', 'ready_for_pickup', 'shipped', 'delivered'));

alter table public.custom_print_request_events drop constraint custom_print_request_events_event_type_check;
alter table public.custom_print_request_events add constraint custom_print_request_events_event_type_check check (
  event_type in ('request_sent', 'proposal_sent', 'proposal_accepted', 'proposal_declined', 'proposal_closed',
    'request_cancelled', 'production_started', 'production_completed', 'delivery_address_selected',
    'shipping_quote_offered', 'shipping_quote_accepted', 'shipping_quote_declined', 'shipment_ready_for_pickup',
    'shipment_shipped', 'shipment_delivered')
);

create or replace function public.set_seller_order_shipping_quote(
  p_order_id uuid, p_carrier text, p_service text, p_shipping_cents bigint, p_delivery_days smallint,
  p_provider_service_id bigint default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype;
begin
  select o.* into order_row from public.seller_purchase_orders o join public.stores s on s.id = o.store_id
    where o.id = p_order_id and s.owner_user_id = (select auth.uid()) for update of o;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or order_row.status <> 'accepted' or order_row.shipping_quote_status not in ('awaiting_quote', 'declined')
    or p_carrier is null or p_carrier not in ('correios', 'melhor_envio', 'transportadora', 'retirada_local')
    or char_length(btrim(coalesce(p_service, ''))) not between 2 and 120
    or p_shipping_cents is null or p_shipping_cents not between 0 and 100000000
    or (p_carrier = 'retirada_local' and (p_shipping_cents <> 0 or p_delivery_days is distinct from 0))
    or (p_carrier <> 'retirada_local' and (p_delivery_days is null or p_delivery_days not between 1 and 365))
    or (p_provider_service_id is not null and (p_provider_service_id < 1 or p_carrier is distinct from 'melhor_envio'))
    or exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id
      and p.status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded')) then
    raise exception using errcode = '22023', message = 'Shipping quote cannot be changed';
  end if;
  update public.seller_purchase_orders set shipping_quote_status = 'offered', shipping_carrier = p_carrier,
    shipping_service = btrim(p_service), shipping_cost_cents = p_shipping_cents, shipping_delivery_days = p_delivery_days,
    shipping_provider_service_id = p_provider_service_id, updated_at = now() where id = p_order_id;
end;
$$;

create or replace function public.set_custom_print_shipping_quote(
  p_request_id uuid, p_carrier text, p_service text, p_shipping_cents bigint, p_delivery_days smallint,
  p_provider_service_id bigint default null, p_package_width_cm numeric default null, p_package_height_cm numeric default null,
  p_package_length_cm numeric default null, p_package_weight_kg numeric default null
)
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
    or p_carrier is null or p_carrier not in ('correios', 'melhor_envio', 'transportadora', 'retirada_local')
    or char_length(btrim(coalesce(p_service, ''))) not between 2 and 120
    or p_shipping_cents is null or p_shipping_cents not between 0 and 100000000
    or (p_carrier = 'retirada_local' and (p_shipping_cents <> 0 or p_delivery_days is distinct from 0
      or p_provider_service_id is not null or p_package_width_cm is not null or p_package_height_cm is not null
      or p_package_length_cm is not null or p_package_weight_kg is not null))
    or (p_carrier <> 'retirada_local' and (p_delivery_days is null or p_delivery_days not between 1 and 365))
    or (p_provider_service_id is not null and (p_provider_service_id < 1 or p_carrier is distinct from 'melhor_envio'
      or p_package_width_cm is null or p_package_width_cm not between 1 and 1000
      or p_package_height_cm is null or p_package_height_cm not between 1 and 1000
      or p_package_length_cm is null or p_package_length_cm not between 1 and 1000
      or p_package_weight_kg is null or p_package_weight_kg not between 0.01 and 30000))
    or (p_provider_service_id is null and (p_package_width_cm is not null or p_package_height_cm is not null
      or p_package_length_cm is not null or p_package_weight_kg is not null))
    or exists (select 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id
      and p.status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded', 'charged_back')) then
    raise exception using errcode = '22023', message = 'Shipping quote cannot be changed';
  end if;
  update public.custom_print_deliveries set shipping_quote_status = 'offered', shipping_carrier = p_carrier,
    shipping_service = btrim(p_service), shipping_cost_cents = p_shipping_cents, shipping_delivery_days = p_delivery_days,
    shipping_provider_service_id = p_provider_service_id, shipping_package_width_cm = p_package_width_cm,
    shipping_package_height_cm = p_package_height_cm, shipping_package_length_cm = p_package_length_cm,
    shipping_package_weight_kg = p_package_weight_kg, updated_at = now() where request_id = p_request_id;
end;
$$;

create function public.mark_seller_purchase_order_ready_for_pickup(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype;
begin
  select o.* into order_row from public.seller_purchase_orders o join public.stores s on s.id = o.store_id
    where o.id = p_order_id and s.owner_user_id = (select auth.uid()) for update of o;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or order_row.status <> 'accepted' or order_row.shipping_quote_status <> 'accepted'
    or order_row.shipping_carrier <> 'retirada_local' or order_row.shipment_status <> 'awaiting_shipment'
    or not exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id and p.status = 'paid') then
    raise exception using errcode = '22023', message = 'Order is not ready for local pickup';
  end if;
  update public.seller_purchase_orders set shipment_status = 'ready_for_pickup', shipping_shipped_at = now(), updated_at = now()
    where id = p_order_id;
end;
$$;

create function public.mark_custom_print_ready_for_pickup(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype; delivery_row public.custom_print_deliveries%rowtype;
begin
  select q.* into request_row from public.custom_print_requests q join public.stores s on s.id = q.winning_store_id
    where q.id = p_request_id and s.owner_user_id = (select auth.uid()) for update of q;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or request_row.status <> 'completed'
    or not exists (select 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id and p.status = 'paid') then
    raise exception using errcode = '42501', message = 'Paid completed request required';
  end if;
  select * into delivery_row from public.custom_print_deliveries d where d.request_id = p_request_id for update;
  if not found or delivery_row.shipping_quote_status <> 'accepted' or delivery_row.shipping_carrier <> 'retirada_local'
    or delivery_row.shipment_status <> 'awaiting_shipment' then
    raise exception using errcode = '22023', message = 'Request is not ready for local pickup';
  end if;
  update public.custom_print_deliveries set shipment_status = 'ready_for_pickup', shipping_shipped_at = now(), updated_at = now()
    where request_id = p_request_id;
end;
$$;

create or replace function public.confirm_seller_purchase_order_delivery(p_order_id uuid, p_complete boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype;
begin
  select o.* into order_row from public.seller_purchase_orders o where o.id = p_order_id and o.buyer_id = (select auth.uid()) for update;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or p_complete is null or (p_complete and order_row.shipment_status <> 'delivered')
    or (not p_complete and order_row.shipment_status not in ('shipped', 'ready_for_pickup')) then
    raise exception using errcode = '42501', message = 'Order delivery cannot be confirmed';
  end if;
  if p_complete then
    update public.seller_purchase_orders set shipment_status = 'completed', completed_at = now(), updated_at = now() where id = p_order_id;
  else
    update public.seller_purchase_orders set shipment_status = 'delivered', shipping_delivered_at = now(), updated_at = now() where id = p_order_id;
  end if;
end;
$$;

create or replace function public.confirm_custom_print_delivery(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype; delivery_row public.custom_print_deliveries%rowtype;
begin
  select q.* into request_row from public.custom_print_requests q where q.id = p_request_id and q.buyer_id = (select auth.uid()) for update;
  if not found or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or request_row.status <> 'completed' then
    raise exception using errcode = '42501', message = 'Completed request unavailable';
  end if;
  select * into delivery_row from public.custom_print_deliveries d where d.request_id = p_request_id for update;
  if not found or delivery_row.shipment_status not in ('shipped', 'ready_for_pickup') then
    raise exception using errcode = '22023', message = 'Shipment is not awaiting delivery confirmation';
  end if;
  update public.custom_print_deliveries set shipment_status = 'delivered', shipping_delivered_at = now(), updated_at = now()
    where request_id = p_request_id;
end;
$$;

create or replace function public.log_seller_purchase_order_event()
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
        case new.shipment_status when 'ready_for_pickup' then 'O pedido está pronto para retirada local.'
          when 'shipped' then 'A loja marcou o pedido como enviado.'
          when 'delivered' then 'O comprador confirmou o recebimento do pedido.'
          else 'O comprador concluiu o pedido.' end,
        jsonb_build_object('tracking_code', new.shipping_tracking_code, 'tracking_url', new.shipping_tracking_url,
          'expected_date', new.shipping_expected_date, 'changed_at', now()));
  end if;
  return new;
end;
$$;

revoke all on function public.mark_seller_purchase_order_ready_for_pickup(uuid),
  public.mark_custom_print_ready_for_pickup(uuid) from public, anon;
grant execute on function public.mark_seller_purchase_order_ready_for_pickup(uuid),
  public.mark_custom_print_ready_for_pickup(uuid) to authenticated;
