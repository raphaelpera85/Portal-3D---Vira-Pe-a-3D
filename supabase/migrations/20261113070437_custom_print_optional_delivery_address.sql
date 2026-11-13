alter table public.custom_print_deliveries
  alter column delivery_recipient_name drop not null,
  alter column delivery_postal_code drop not null,
  alter column delivery_street drop not null,
  alter column delivery_number drop not null,
  alter column delivery_complement drop not null,
  alter column delivery_district drop not null,
  alter column delivery_city drop not null,
  alter column delivery_state_code drop not null,
  alter column delivery_reference drop not null,
  drop constraint custom_print_deliveries_delivery_recipient_name_check,
  drop constraint custom_print_deliveries_delivery_postal_code_check,
  drop constraint custom_print_deliveries_delivery_street_check,
  drop constraint custom_print_deliveries_delivery_number_check,
  drop constraint custom_print_deliveries_delivery_district_check,
  drop constraint custom_print_deliveries_delivery_city_check,
  drop constraint custom_print_deliveries_delivery_state_code_check,
  drop constraint custom_print_deliveries_delivery_complement_check,
  drop constraint custom_print_deliveries_delivery_reference_check,
  add constraint custom_print_deliveries_delivery_address_check check (
    (delivery_recipient_name is null and delivery_postal_code is null and delivery_street is null
      and delivery_number is null and delivery_complement is null and delivery_district is null
      and delivery_city is null and delivery_state_code is null and delivery_reference is null)
    or (delivery_recipient_name is not null and char_length(btrim(delivery_recipient_name)) between 2 and 100
      and delivery_postal_code is not null and delivery_postal_code ~ '^\d{8}$'
      and delivery_street is not null and char_length(btrim(delivery_street)) between 2 and 120
      and delivery_number is not null and char_length(btrim(delivery_number)) between 1 and 20
      and delivery_complement is not null and char_length(delivery_complement) <= 100
      and delivery_district is not null and char_length(btrim(delivery_district)) between 2 and 100
      and delivery_city is not null and char_length(btrim(delivery_city)) between 2 and 100
      and delivery_state_code is not null and delivery_state_code ~ '^[A-Z]{2}$'
      and delivery_reference is not null and char_length(delivery_reference) <= 200)
  );

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
  if p_carrier is null or p_carrier not in ('correios', 'melhor_envio', 'transportadora', 'retirada_local')
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
  select * into delivery_row from public.custom_print_deliveries d where d.request_id = p_request_id for update;
  if not found then
    if p_carrier <> 'retirada_local' then
      raise exception using errcode = '22023', message = 'A delivery address is required for shipping quotes';
    end if;
    insert into public.custom_print_deliveries (
      request_id, buyer_id, delivery_complement, delivery_reference, shipping_quote_status, shipping_carrier, shipping_service,
      shipping_cost_cents, shipping_delivery_days, updated_at
    ) values (
      p_request_id, request_row.buyer_id, null, null, 'offered', p_carrier, btrim(p_service), p_shipping_cents, p_delivery_days, now()
    );
    return;
  end if;
  if delivery_row.shipping_quote_status not in ('awaiting_quote', 'declined') then
    raise exception using errcode = '22023', message = 'Shipping quote cannot be changed';
  end if;
  if p_carrier <> 'retirada_local' and delivery_row.delivery_postal_code is null then
    raise exception using errcode = '22023', message = 'A delivery address is required for shipping quotes';
  end if;
  update public.custom_print_deliveries set shipping_quote_status = 'offered', shipping_carrier = p_carrier,
    shipping_service = btrim(p_service), shipping_cost_cents = p_shipping_cents, shipping_delivery_days = p_delivery_days,
    shipping_provider_service_id = p_provider_service_id, shipping_package_width_cm = p_package_width_cm,
    shipping_package_height_cm = p_package_height_cm, shipping_package_length_cm = p_package_length_cm,
    shipping_package_weight_kg = p_package_weight_kg,
    delivery_recipient_name = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_recipient_name end,
    delivery_postal_code = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_postal_code end,
    delivery_street = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_street end,
    delivery_number = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_number end,
    delivery_complement = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_complement end,
    delivery_district = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_district end,
    delivery_city = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_city end,
    delivery_state_code = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_state_code end,
    delivery_reference = case when p_carrier = 'retirada_local' then null else delivery_row.delivery_reference end,
    updated_at = now() where request_id = p_request_id;
end;
$$;

create or replace function public.log_custom_print_delivery_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_event text; next_data jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.delivery_recipient_name is not null then
      next_event := 'delivery_address_selected';
    elsif new.shipping_quote_status = 'offered' then
      next_event := 'shipping_quote_offered';
    end if;
  elsif new.delivery_recipient_name is not null and
    row(new.delivery_recipient_name, new.delivery_postal_code, new.delivery_street, new.delivery_number,
      new.delivery_complement, new.delivery_district, new.delivery_city, new.delivery_state_code, new.delivery_reference)
      is distinct from
    row(old.delivery_recipient_name, old.delivery_postal_code, old.delivery_street, old.delivery_number,
      old.delivery_complement, old.delivery_district, old.delivery_city, old.delivery_state_code, old.delivery_reference) then
    next_event := 'delivery_address_selected';
  elsif old.shipping_quote_status is distinct from new.shipping_quote_status
    and new.shipping_quote_status in ('offered', 'accepted', 'declined') then
    next_event := 'shipping_quote_' || new.shipping_quote_status;
  elsif old.shipment_status is distinct from new.shipment_status then
    next_event := 'shipment_' || new.shipment_status;
  end if;
  if next_event = 'shipping_quote_offered' then
    next_data := jsonb_build_object('carrier', new.shipping_carrier, 'service', new.shipping_service,
      'shipping_cents', new.shipping_cost_cents, 'delivery_days', new.shipping_delivery_days);
  elsif next_event = 'shipment_shipped' then
    next_data := jsonb_build_object('tracking_code', new.shipping_tracking_code,
      'tracking_url', new.shipping_tracking_url, 'expected_date', new.shipping_expected_date);
  end if;
  if next_event is not null then
    insert into public.custom_print_request_events (target_id, actor_user_id, event_type, event_data)
      select t.id, (select auth.uid()), next_event, next_data
      from public.custom_print_requests q join public.custom_print_request_targets t
        on t.request_id = q.id and t.store_id = q.winning_store_id where q.id = new.request_id;
  end if;
  return new;
end;
$$;
revoke all on function public.log_custom_print_delivery_event() from public, anon, authenticated;
drop trigger log_custom_print_delivery_event_after_change on public.custom_print_deliveries;
create trigger log_custom_print_delivery_event_after_change
  after insert or update of delivery_recipient_name, delivery_postal_code, delivery_street, delivery_number,
    delivery_complement, delivery_district, delivery_city, delivery_state_code, delivery_reference,
    shipping_quote_status, shipment_status on public.custom_print_deliveries
  for each row execute function public.log_custom_print_delivery_event();
