create or replace function public.create_maker_consignment_item_with_fees(
  p_establishment text,
  p_product_name text,
  p_quantity integer,
  p_unit_cost_brl numeric,
  p_sale_price_brl numeric,
  p_commission_percent numeric,
  p_commission_fixed_fee_brl numeric,
  p_product_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_item uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Maker account required';
  end if;
  if p_commission_fixed_fee_brl is null or p_commission_fixed_fee_brl not between 0 and 1000000 then
    raise exception using errcode = '22023', message = 'Invalid consignment fee';
  end if;

  new_item := public.create_maker_consignment_item(
    p_establishment, p_product_name, p_quantity, p_unit_cost_brl,
    p_sale_price_brl, p_commission_percent, p_product_id
  );
  update public.maker_consignment_items
    set commission_fixed_fee_brl = p_commission_fixed_fee_brl
    where id = new_item;
  return new_item;
end;
$$;
revoke all on function public.create_maker_consignment_item_with_fees(text, text, integer, numeric, numeric, numeric, numeric, uuid) from public, anon;
grant execute on function public.create_maker_consignment_item_with_fees(text, text, integer, numeric, numeric, numeric, numeric, uuid) to authenticated;

create or replace function public.set_seller_order_shipping_quote_with_packages(
  p_order_id uuid, p_carrier text, p_service text, p_shipping_cents bigint, p_delivery_days smallint,
  p_provider_service_id bigint, p_packages jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Maker account required';
  end if;
  if p_carrier is distinct from 'melhor_envio' or not public.is_valid_melhor_envio_packages(p_packages) then
    raise exception using errcode = '22023', message = 'Invalid shipping packages';
  end if;
  perform public.set_seller_order_shipping_quote(p_order_id, p_carrier, p_service, p_shipping_cents,
    p_delivery_days, p_provider_service_id);
  update public.seller_purchase_orders set shipping_quote_packages = p_packages, updated_at = now()
    where id = p_order_id;
end;
$$;
revoke all on function public.set_seller_order_shipping_quote_with_packages(uuid, text, text, bigint, smallint, bigint, jsonb) from public, anon;
grant execute on function public.set_seller_order_shipping_quote_with_packages(uuid, text, text, bigint, smallint, bigint, jsonb) to authenticated;

create or replace function public.set_custom_print_shipping_quote_with_packages(
  p_request_id uuid, p_carrier text, p_service text, p_shipping_cents bigint, p_delivery_days smallint,
  p_provider_service_id bigint, p_packages jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare first_package jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Maker account required';
  end if;
  if p_carrier is distinct from 'melhor_envio' or not public.is_valid_melhor_envio_packages(p_packages) then
    raise exception using errcode = '22023', message = 'Invalid shipping packages';
  end if;
  first_package := p_packages -> 0;
  perform public.set_custom_print_shipping_quote(p_request_id, p_carrier, p_service, p_shipping_cents,
    p_delivery_days, p_provider_service_id, (first_package ->> 'width')::numeric,
    (first_package ->> 'height')::numeric, (first_package ->> 'length')::numeric,
    (first_package ->> 'weight')::numeric);
  update public.custom_print_deliveries set shipping_quote_packages = p_packages, updated_at = now()
    where request_id = p_request_id;
end;
$$;
revoke all on function public.set_custom_print_shipping_quote_with_packages(uuid, text, text, bigint, smallint, bigint, jsonb) from public, anon;
grant execute on function public.set_custom_print_shipping_quote_with_packages(uuid, text, text, bigint, smallint, bigint, jsonb) to authenticated;
