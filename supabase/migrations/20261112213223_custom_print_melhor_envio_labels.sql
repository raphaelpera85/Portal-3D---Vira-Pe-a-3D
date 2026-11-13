alter table public.custom_print_deliveries
  add column shipping_provider_service_id bigint check (
    shipping_provider_service_id is null
    or (shipping_provider_service_id > 0 and shipping_carrier = 'melhor_envio')
  );

alter table public.seller_order_shipping_labels
  alter column order_id drop not null,
  add column custom_print_request_id uuid unique references public.custom_print_requests(id) on delete cascade,
  add constraint seller_order_shipping_labels_one_target_check check (
    (order_id is not null and custom_print_request_id is null)
    or (order_id is null and custom_print_request_id is not null)
  );

create function public.clear_custom_print_shipping_service_on_reset()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.shipping_quote_status in ('awaiting_quote', 'declined')
    or old.delivery_postal_code is distinct from new.delivery_postal_code then
    new.shipping_provider_service_id := null;
  end if;
  return new;
end;
$$;
revoke all on function public.clear_custom_print_shipping_service_on_reset() from public, anon, authenticated;
create trigger clear_custom_print_shipping_service_before_reset
  before update of shipping_quote_status, delivery_postal_code on public.custom_print_deliveries
  for each row execute function public.clear_custom_print_shipping_service_on_reset();

drop function public.set_custom_print_shipping_quote(uuid, text, text, bigint, smallint);
create function public.set_custom_print_shipping_quote(
  p_request_id uuid,
  p_carrier text,
  p_service text,
  p_shipping_cents bigint,
  p_delivery_days smallint,
  p_provider_service_id bigint default null
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
    or (p_provider_service_id is not null and (p_provider_service_id < 1 or p_carrier is distinct from 'melhor_envio'))
    or exists (select 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id
      and p.status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded', 'charged_back')) then
    raise exception using errcode = '22023', message = 'Shipping quote cannot be changed';
  end if;
  update public.custom_print_deliveries set shipping_quote_status = 'offered', shipping_carrier = p_carrier,
    shipping_service = btrim(p_service), shipping_cost_cents = p_shipping_cents,
    shipping_delivery_days = p_delivery_days, shipping_provider_service_id = p_provider_service_id,
    updated_at = now() where request_id = p_request_id;
end;
$$;

revoke all on function public.set_custom_print_shipping_quote(uuid, text, text, bigint, smallint, bigint) from public, anon;
grant execute on function public.set_custom_print_shipping_quote(uuid, text, text, bigint, smallint, bigint) to authenticated;
