alter table public.custom_print_deliveries
  add column shipping_package_width_cm numeric(7, 2),
  add column shipping_package_height_cm numeric(7, 2),
  add column shipping_package_length_cm numeric(7, 2),
  add column shipping_package_weight_kg numeric(9, 3),
  add constraint custom_print_delivery_package_dimensions_check check (
    (shipping_package_width_cm is null and shipping_package_height_cm is null
      and shipping_package_length_cm is null and shipping_package_weight_kg is null)
    or (shipping_package_width_cm between 1 and 1000 and shipping_package_height_cm between 1 and 1000
      and shipping_package_length_cm between 1 and 1000 and shipping_package_weight_kg between 0.01 and 30000)
  ),
  add constraint custom_print_delivery_package_quote_check check (
    shipping_provider_service_id is null or shipping_package_width_cm is not null
  );

create or replace function public.clear_custom_print_shipping_service_on_reset()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.shipping_quote_status in ('awaiting_quote', 'declined')
    or old.delivery_postal_code is distinct from new.delivery_postal_code then
    new.shipping_provider_service_id := null;
    new.shipping_package_width_cm := null;
    new.shipping_package_height_cm := null;
    new.shipping_package_length_cm := null;
    new.shipping_package_weight_kg := null;
  end if;
  return new;
end;
$$;

drop function public.set_custom_print_shipping_quote(uuid, text, text, bigint, smallint, bigint);
create function public.set_custom_print_shipping_quote(
  p_request_id uuid,
  p_carrier text,
  p_service text,
  p_shipping_cents bigint,
  p_delivery_days smallint,
  p_provider_service_id bigint default null,
  p_package_width_cm numeric default null,
  p_package_height_cm numeric default null,
  p_package_length_cm numeric default null,
  p_package_weight_kg numeric default null
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
    or p_carrier is null or p_carrier not in ('correios', 'melhor_envio', 'transportadora')
    or char_length(btrim(coalesce(p_service, ''))) not between 2 and 120
    or p_shipping_cents is null or p_shipping_cents not between 0 and 100000000
    or p_delivery_days is null or p_delivery_days not between 1 and 365
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
    shipping_service = btrim(p_service), shipping_cost_cents = p_shipping_cents,
    shipping_delivery_days = p_delivery_days, shipping_provider_service_id = p_provider_service_id,
    shipping_package_width_cm = p_package_width_cm, shipping_package_height_cm = p_package_height_cm,
    shipping_package_length_cm = p_package_length_cm, shipping_package_weight_kg = p_package_weight_kg,
    updated_at = now() where request_id = p_request_id;
end;
$$;

revoke all on function public.set_custom_print_shipping_quote(uuid, text, text, bigint, smallint, bigint, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.set_custom_print_shipping_quote(uuid, text, text, bigint, smallint, bigint, numeric, numeric, numeric, numeric) to authenticated;
