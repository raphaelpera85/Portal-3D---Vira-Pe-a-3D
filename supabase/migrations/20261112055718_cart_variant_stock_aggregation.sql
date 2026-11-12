create or replace function public.validate_product_stock_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  available_stock integer;
  existing_quantity integer := 0;
begin
  if tg_table_name = 'product_quote_requests' and new.request_type <> 'purchase' then return new; end if;
  select p.stock_quantity into available_stock from public.marketplace_products p where p.id = new.product_id for update;
  if not found then raise exception using errcode = '22023', message = 'Product is unavailable'; end if;
  if available_stock is null then return new; end if;

  if tg_table_name = 'buyer_cart_items' then
    select coalesce(sum(i.quantity), 0)::integer into existing_quantity from public.buyer_cart_items i
      where i.cart_id = new.cart_id and i.product_id = new.product_id
        and (tg_op <> 'UPDATE' or i.id <> new.id);
  elsif tg_table_name = 'seller_purchase_order_items' then
    select coalesce(sum(i.quantity), 0)::integer into existing_quantity from public.seller_purchase_order_items i
      where i.order_id = new.order_id and i.product_id = new.product_id;
  end if;

  if existing_quantity + new.quantity > available_stock then
    raise exception using errcode = '22023', message = 'Requested quantity exceeds available stock';
  end if;
  return new;
end;
$$;

create or replace function public.create_orders_from_cart(p_buyer_address_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
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
  ) then raise exception using errcode = '42501', message = 'Buyer account required'; end if;

  select a.recipient_name, a.postal_code, a.street, a.number, a.complement, a.district, a.city, a.state_code, a.reference
    into shipping from public.buyer_addresses a
    where a.id = p_buyer_address_id and a.buyer_id = (select auth.uid()) for share;
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
      or i.price_brl <> p.price_brl or i.store_name <> s.name
      or not public.valid_product_variant_options(coalesce(p.product_properties -> 'variant_options', '{}'::jsonb), i.variant_options)
      or i.product_name <> public.product_variant_product_name(p.name, i.variant_options))
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
      select new_order, p.id, i.product_name, i.price_brl, i.quantity
      from public.buyer_cart_items i join public.marketplace_products p on p.id = i.product_id
      where i.cart_id = cart_key and p.store_id = seller.id;
    select sum(i.quantity), string_agg(i.product_name, ', ' order by i.product_name) into total_quantity, product_summary
      from public.buyer_cart_items i join public.marketplace_products p on p.id = i.product_id
      where i.cart_id = cart_key and p.store_id = seller.id;
    insert into public.store_notification_deliveries (order_id, channel, destination, payload)
      select new_order, 'email', c.email, jsonb_build_object('request_type', 'purchase', 'product_name', left(product_summary, 500), 'quantity', total_quantity)
      from public.store_notification_contacts c where c.store_id = seller.id
      union all
      select new_order, 'whatsapp', c.whatsapp, jsonb_build_object('request_type', 'purchase', 'product_name', left(product_summary, 500), 'quantity', total_quantity)
      from public.store_notification_contacts c where c.store_id = seller.id and c.whatsapp is not null and c.whatsapp_opt_in;
    return next new_order;
  end loop;
  delete from public.buyer_cart_items where cart_id = cart_key;
end;
$$;
