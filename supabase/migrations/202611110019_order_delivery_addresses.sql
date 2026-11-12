alter table public.seller_purchase_orders
  add column delivery_recipient_name text,
  add column delivery_postal_code text,
  add column delivery_street text,
  add column delivery_number text,
  add column delivery_complement text,
  add column delivery_district text,
  add column delivery_city text,
  add column delivery_state_code text,
  add column delivery_reference text,
  add constraint seller_purchase_orders_delivery_address_check check (
    (delivery_recipient_name is null and delivery_postal_code is null and delivery_street is null
      and delivery_number is null and delivery_complement is null and delivery_district is null
      and delivery_city is null and delivery_state_code is null and delivery_reference is null)
    or (delivery_recipient_name is not null and delivery_postal_code is not null and delivery_postal_code ~ '^\d{8}$'
      and delivery_street is not null and delivery_number is not null and delivery_complement is not null
      and delivery_district is not null and delivery_city is not null and delivery_state_code is not null
      and delivery_state_code ~ '^[A-Z]{2}$' and delivery_reference is not null)
  );

drop function public.create_orders_from_cart();

create function public.create_orders_from_cart(p_buyer_address_id uuid)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  cart_key uuid;
  seller record;
  new_order uuid;
  total_quantity integer;
  product_summary text;
  shipping record;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;

  select a.recipient_name, a.postal_code, a.street, a.number, a.complement, a.district, a.city, a.state_code, a.reference
    into shipping from public.buyer_addresses a
    where a.id = p_buyer_address_id and a.buyer_id = (select auth.uid())
    for share;
  if not found then raise exception using errcode = '22023', message = 'Delivery address is unavailable'; end if;

  select c.id into cart_key from public.buyer_carts c where c.buyer_id = (select auth.uid()) for update;
  if cart_key is null or not exists (select 1 from public.buyer_cart_items i where i.cart_id = cart_key) then
    raise exception using errcode = '22023', message = 'Cart is empty';
  end if;
  if exists (
    select 1 from public.buyer_cart_items i
    join public.marketplace_products p on p.id = i.product_id
    join public.stores s on s.id = p.store_id
    where i.cart_id = cart_key and (p.catalog_status <> 'published' or p.price_mode <> 'fixed' or s.status <> 'published'
      or i.price_brl <> p.price_brl or i.store_name <> s.name or i.product_name <> p.name)
  ) then raise exception using errcode = '22023', message = 'Cart contains an unavailable product'; end if;

  for seller in
    select distinct s.id, s.name from public.buyer_cart_items i
    join public.marketplace_products p on p.id = i.product_id
    join public.stores s on s.id = p.store_id where i.cart_id = cart_key order by s.id
  loop
    insert into public.seller_purchase_orders (
      buyer_id, store_id, store_name, delivery_recipient_name, delivery_postal_code, delivery_street,
      delivery_number, delivery_complement, delivery_district, delivery_city, delivery_state_code, delivery_reference
    ) values (
      (select auth.uid()), seller.id, seller.name, shipping.recipient_name, shipping.postal_code, shipping.street,
      shipping.number, shipping.complement, shipping.district, shipping.city, shipping.state_code, shipping.reference
    ) returning id into new_order;

    insert into public.seller_purchase_order_items (order_id, product_id, product_name, unit_price_brl, quantity)
      select new_order, p.id, p.name, i.price_brl, i.quantity
      from public.buyer_cart_items i join public.marketplace_products p on p.id = i.product_id
      where i.cart_id = cart_key and p.store_id = seller.id;
    select sum(i.quantity), string_agg(p.name, ', ' order by p.name) into total_quantity, product_summary
      from public.buyer_cart_items i join public.marketplace_products p on p.id = i.product_id
      where i.cart_id = cart_key and p.store_id = seller.id;
    insert into public.store_notification_deliveries (order_id, channel, destination, payload)
      select new_order, 'email', c.email, jsonb_build_object('request_type', 'purchase', 'product_name', left(product_summary, 300), 'quantity', total_quantity)
      from public.store_notification_contacts c where c.store_id = seller.id
      union all
      select new_order, 'whatsapp', c.whatsapp, jsonb_build_object('request_type', 'purchase', 'product_name', left(product_summary, 300), 'quantity', total_quantity)
      from public.store_notification_contacts c where c.store_id = seller.id and c.whatsapp is not null and c.whatsapp_opt_in;
    return next new_order;
  end loop;
  delete from public.buyer_cart_items where cart_id = cart_key;
end;
$$;

revoke all on function public.create_orders_from_cart(uuid) from public, anon;
grant execute on function public.create_orders_from_cart(uuid) to authenticated;
