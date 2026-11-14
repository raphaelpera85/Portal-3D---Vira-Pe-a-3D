alter table public.seller_purchase_orders
  drop constraint seller_purchase_orders_status_check,
  add constraint seller_purchase_orders_status_check
    check (status in ('pending', 'accepted', 'declined', 'cancelled'));

create function public.cancel_seller_purchase_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;

  select o.* into order_row from public.seller_purchase_orders o
    where o.id = p_order_id and o.buyer_id = (select auth.uid()) for update;
  if not found or order_row.status not in ('pending', 'accepted') or order_row.shipment_status <> 'awaiting_shipment'
    or exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id
      and p.status not in ('failed', 'expired', 'cancelled'))
    or exists (select 1 from public.seller_order_shipping_labels l where l.order_id = p_order_id) then
    raise exception using errcode = '22023', message = 'Order cannot be cancelled';
  end if;

  update public.seller_purchase_orders set status = 'cancelled', updated_at = now() where id = p_order_id;
  insert into public.seller_purchase_order_events (order_id, actor_user_id, event_type, description)
    values (p_order_id, (select auth.uid()), 'order_cancelled', 'O comprador cancelou o pedido antes do pagamento e do envio.');
end;
$$;

revoke all on function public.cancel_seller_purchase_order(uuid) from public, anon;
grant execute on function public.cancel_seller_purchase_order(uuid) to authenticated;
