alter table public.buyer_cart_items add column variant_options jsonb not null default '{}'::jsonb
  check (jsonb_typeof(variant_options) = 'object');
alter table public.buyer_cart_items drop constraint buyer_cart_items_cart_id_product_id_key;
create unique index buyer_cart_items_cart_product_variant_unique
  on public.buyer_cart_items (cart_id, product_id, variant_options);

create function public.valid_product_variant_options(p_available jsonb, p_selected jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(coalesce(p_available, '{}'::jsonb)) <> 'object'
      or jsonb_typeof(coalesce(p_selected, '{}'::jsonb)) <> 'object' then false
    else
      (select count(*) from jsonb_each(coalesce(p_available, '{}'::jsonb)))
        = (select count(*) from jsonb_each(coalesce(p_selected, '{}'::jsonb)))
      and not exists (
        select 1 from jsonb_each(coalesce(p_selected, '{}'::jsonb)) chosen
        where jsonb_typeof(chosen.value) <> 'string'
      )
      and not exists (
        select 1 from jsonb_each_text(coalesce(p_selected, '{}'::jsonb)) chosen
        where not exists (
          select 1 from jsonb_each(coalesce(p_available, '{}'::jsonb)) available
          where available.key = chosen.key
            and jsonb_typeof(available.value) = 'array'
            and available.value @> jsonb_build_array(chosen.value)
        )
      )
  end;
$$;

create function public.product_variant_product_name(p_product_name text, p_options jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_options, '{}'::jsonb) = '{}'::jsonb then p_product_name
    else p_product_name || ' · ' || (
      select string_agg(option.key || ': ' || option.value, ' · ' order by option.key)
      from jsonb_each_text(p_options) option
    )
  end;
$$;

revoke all on function public.valid_product_variant_options(jsonb, jsonb),
  public.product_variant_product_name(text, jsonb) from public, anon, authenticated;

drop function public.add_product_to_cart(uuid, smallint);
create function public.add_product_to_cart(
  p_product_id uuid, p_quantity smallint default 1, p_variant_options jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cart_key uuid;
  added_count integer;
  product_row public.marketplace_products%rowtype;
  store_row public.stores%rowtype;
begin
  if (select auth.uid()) is null or p_quantity is null or p_quantity not between 1 and 100
     or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '22023', message = 'Invalid cart item';
  end if;
  select p.* into product_row from public.marketplace_products p
    join public.stores s on s.id = p.store_id
    where p.id = p_product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published';
  if not found then raise exception using errcode = '22023', message = 'Product is not available for cart purchase'; end if;
  if not public.valid_product_variant_options(coalesce(product_row.product_properties -> 'variant_options', '{}'::jsonb), p_variant_options) then
    raise exception using errcode = '22023', message = 'Invalid product variant';
  end if;
  select s.* into store_row from public.stores s where s.id = product_row.store_id;
  insert into public.buyer_carts (buyer_id) values ((select auth.uid()))
    on conflict (buyer_id) do update set updated_at = now() returning id into cart_key;
  insert into public.buyer_cart_items (cart_id, product_id, store_id, store_name, product_name, price_brl, quantity, variant_options)
    values (cart_key, product_row.id, store_row.id, store_row.name,
      public.product_variant_product_name(product_row.name, p_variant_options), product_row.price_brl, p_quantity, p_variant_options)
    on conflict (cart_id, product_id, variant_options) do update
      set quantity = public.buyer_cart_items.quantity + excluded.quantity,
          store_id = excluded.store_id, store_name = excluded.store_name,
          product_name = excluded.product_name, price_brl = excluded.price_brl, updated_at = now()
      where public.buyer_cart_items.quantity + excluded.quantity <= 100;
  get diagnostics added_count = row_count;
  if added_count = 0 then raise exception using errcode = '22023', message = 'Cart quantity limit exceeded'; end if;
end;
$$;

create or replace function public.set_cart_item_quantity(p_item_id uuid, p_quantity smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare cart_key uuid;
begin
  if (select auth.uid()) is null or p_quantity is null or p_quantity not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid cart quantity';
  end if;
  select c.id into cart_key from public.buyer_carts c join public.buyer_cart_items i on i.cart_id = c.id
    where i.id = p_item_id and c.buyer_id = (select auth.uid()) for update of c;
  if cart_key is null then raise exception using errcode = '42501', message = 'Cart item not found'; end if;
  update public.buyer_cart_items i set quantity = p_quantity,
    product_name = coalesce((select public.product_variant_product_name(p.name, i.variant_options)
      from public.marketplace_products p where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed'), i.product_name),
    store_name = coalesce((select s.name from public.marketplace_products p join public.stores s on s.id = p.store_id where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.store_name),
    store_id = coalesce((select p.store_id from public.marketplace_products p join public.stores s on s.id = p.store_id where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.store_id),
    price_brl = coalesce((select p.price_brl from public.marketplace_products p join public.stores s on s.id = p.store_id where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.price_brl),
    updated_at = now()
    where i.id = p_item_id and i.cart_id = cart_key;
  if not found then raise exception using errcode = '42501', message = 'Cart item not found'; end if;
end;
$$;

drop function public.create_orders_from_cart(uuid);
create function public.create_orders_from_cart(p_buyer_address_id uuid)
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

revoke all on function public.add_product_to_cart(uuid, smallint, jsonb), public.create_orders_from_cart(uuid),
  public.set_cart_item_quantity(uuid, smallint) from public, anon;
grant execute on function public.add_product_to_cart(uuid, smallint, jsonb), public.create_orders_from_cart(uuid),
  public.set_cart_item_quantity(uuid, smallint) to authenticated;
