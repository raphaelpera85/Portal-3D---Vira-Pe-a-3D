alter table public.seller_purchase_orders
  add column shipping_provider_service_id bigint check (
    shipping_provider_service_id is null
    or (shipping_provider_service_id > 0 and shipping_carrier = 'melhor_envio')
  );

drop function public.set_seller_order_shipping_quote(uuid, text, text, bigint, smallint);
create function public.set_seller_order_shipping_quote(
  p_order_id uuid,
  p_carrier text,
  p_service text,
  p_shipping_cents bigint,
  p_delivery_days smallint,
  p_provider_service_id bigint default null
)
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

create or replace function public.respond_to_seller_order_shipping_quote(p_order_id uuid, p_response text)
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
      shipping_service = null, shipping_cost_cents = null, shipping_delivery_days = null,
      shipping_provider_service_id = null, updated_at = now() where id = p_order_id;
  end if;
end;
$$;

revoke all on function public.set_seller_order_shipping_quote(uuid, text, text, bigint, smallint, bigint) from public, anon;
grant execute on function public.set_seller_order_shipping_quote(uuid, text, text, bigint, smallint, bigint) to authenticated;
