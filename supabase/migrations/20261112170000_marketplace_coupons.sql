create table public.marketplace_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  discount_percent_bps integer,
  discount_fixed_cents bigint,
  active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (discount_percent_bps is not null and discount_percent_bps between 1 and 9999 and discount_fixed_cents is null)
    or (discount_percent_bps is null and discount_fixed_cents is not null and discount_fixed_cents > 0)
  )
);

alter table public.seller_purchase_orders
  add column coupon_code text,
  add column coupon_discount_cents bigint not null default 0 check (coupon_discount_cents >= 0);

alter table public.marketplace_coupons enable row level security;
revoke all on public.marketplace_coupons from anon, authenticated;
grant select, insert, update on public.marketplace_coupons to authenticated;
create policy "Admins manage marketplace coupons" on public.marketplace_coupons
  for all to authenticated
  using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role))
  with check (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role));

create or replace function public.get_marketplace_coupon_quote(p_cart_id uuid, p_code text)
returns table (coupon_code text, subtotal_cents bigint, discount_cents bigint, store_discounts jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  buyer_id uuid := (select auth.uid());
  cart_owner uuid;
  coupon_row public.marketplace_coupons%rowtype;
  normalized_code text := upper(trim(p_code));
  total_subtotal bigint;
  total_capacity bigint;
  store_count bigint;
  maximum_discount bigint;
  requested_discount bigint;
  final_discount bigint;
  remaining_cents bigint;
  allocations jsonb;
begin
  if buyer_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = buyer_id and r.role = 'buyer'::public.app_role
  ) then raise exception using errcode = '42501', message = 'Buyer account required'; end if;
  if normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$' then
    raise exception using errcode = '22023', message = 'Coupon is invalid or unavailable';
  end if;
  select c.buyer_id into cart_owner from public.buyer_carts c where c.id = p_cart_id;
  if cart_owner is distinct from buyer_id then raise exception using errcode = '42501', message = 'Cart is unavailable'; end if;
  select c.* into coupon_row from public.marketplace_coupons c where c.code = normalized_code and c.active for share;
  if not found then raise exception using errcode = '22023', message = 'Coupon is invalid or unavailable'; end if;

  select sum(round(i.price_brl * 100)::bigint * i.quantity)::bigint, count(distinct i.store_id)
    into total_subtotal, store_count from public.buyer_cart_items i where i.cart_id = p_cart_id;
  if total_subtotal is null or total_subtotal < 1 then
    raise exception using errcode = '22023', message = 'Coupon is invalid or unavailable';
  end if;
  select sum(greatest(t.store_subtotal - 1, 0))::bigint into total_capacity from (
    select i.store_id, sum(round(i.price_brl * 100)::bigint * i.quantity)::bigint as store_subtotal
      from public.buyer_cart_items i where i.cart_id = p_cart_id group by i.store_id
  ) t;
  maximum_discount := greatest(total_subtotal - store_count, 0);
  if coupon_row.discount_percent_bps is not null then
    requested_discount := floor(total_subtotal::numeric * coupon_row.discount_percent_bps / 10000)::bigint;
  else
    requested_discount := coupon_row.discount_fixed_cents;
  end if;
  final_discount := least(requested_discount, maximum_discount, coalesce(total_capacity, 0));
  if final_discount < 1 or total_capacity < 1 then
    raise exception using errcode = '22023', message = 'Coupon is invalid or unavailable for this cart';
  end if;

  with seller_totals as (
    select i.store_id, sum(round(i.price_brl * 100)::bigint * i.quantity)::bigint as seller_subtotal
      from public.buyer_cart_items i where i.cart_id = p_cart_id group by i.store_id
  ), capacities as (
    select t.store_id, t.seller_subtotal, greatest(t.seller_subtotal - 1, 0)::bigint as capacity from seller_totals t
  ), bases as (
    select c.store_id, c.seller_subtotal, c.capacity,
      floor(final_discount::numeric * c.capacity / total_capacity)::bigint as base_cents,
      mod(final_discount::numeric * c.capacity, total_capacity::numeric) as remainder
      from capacities c
  ), ranked as (
    select b.*, row_number() over (order by b.remainder desc, b.store_id) as remainder_rank,
      final_discount - sum(b.base_cents) over () as remainder_cents from bases b
  )
  select jsonb_object_agg(r.store_id::text,
    r.base_cents + case when r.remainder_rank <= r.remainder_cents then 1 else 0 end)
    into allocations from ranked r;

  return query select normalized_code, total_subtotal, final_discount, coalesce(allocations, '{}'::jsonb);
end;
$$;

create function public.preview_marketplace_coupon(p_code text)
returns table (coupon_code text, subtotal_cents bigint, discount_cents bigint, store_discounts jsonb)
language plpgsql security definer set search_path = '' as $$
declare cart_key uuid;
begin
  select c.id into cart_key from public.buyer_carts c where c.buyer_id = (select auth.uid());
  if cart_key is null then raise exception using errcode = '22023', message = 'Cart is empty'; end if;
  return query select q.coupon_code, q.subtotal_cents, q.discount_cents, q.store_discounts
    from public.get_marketplace_coupon_quote(cart_key, p_code) q;
end;
$$;

drop function public.create_orders_from_cart(uuid);
create function public.create_orders_from_cart(p_buyer_address_id uuid, p_coupon_code text default null)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  cart_key uuid;
  seller record;
  new_order uuid;
  total_quantity integer;
  product_summary text;
  shipping record;
  normalized_coupon text := nullif(upper(trim(p_coupon_code)), '');
  quoted_coupon_code text;
  quoted_store_discounts jsonb := '{}'::jsonb;
  seller_discount bigint;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;
  select a.recipient_name, a.postal_code, a.street, a.number, a.complement, a.district, a.city, a.state_code, a.reference
    into shipping from public.buyer_addresses a where a.id = p_buyer_address_id and a.buyer_id = (select auth.uid()) for share;
  if not found then raise exception using errcode = '22023', message = 'Delivery address is unavailable'; end if;
  select c.id into cart_key from public.buyer_carts c where c.buyer_id = (select auth.uid()) for update;
  if cart_key is null or not exists (select 1 from public.buyer_cart_items i where i.cart_id = cart_key) then
    raise exception using errcode = '22023', message = 'Cart is empty';
  end if;
  if exists (
    select 1 from public.buyer_cart_items i join public.marketplace_products p on p.id = i.product_id
    join public.stores s on s.id = p.store_id left join public.marketplace_product_variants v
      on v.id = i.variant_id and v.product_id = i.product_id
    where i.cart_id = cart_key and (p.listing_type <> 'physical' or p.catalog_status <> 'published'
      or p.price_mode <> 'fixed' or s.status <> 'published'
      or i.store_name <> s.name
      or not public.valid_product_variant_options(coalesce(p.product_properties -> 'variant_options', '{}'::jsonb), i.variant_options)
      or i.product_name <> public.product_variant_product_name(p.name, i.variant_options)
      or (i.variant_id is not null and (v.id is null or v.variant_options <> i.variant_options or v.price_brl <> i.price_brl))
      or (i.variant_id is null and (exists (select 1 from public.marketplace_product_variants x where x.product_id = p.id)
        or i.price_brl <> p.price_brl)))
  ) then raise exception using errcode = '22023', message = 'Cart contains an unavailable product'; end if;
  if exists (
    select 1 from public.buyer_cart_items i join public.marketplace_product_variants v on v.id = i.variant_id
    where i.cart_id = cart_key group by i.variant_id, v.stock_quantity
    having v.stock_quantity is not null and sum(i.quantity) > v.stock_quantity
  ) then raise exception using errcode = '22023', message = 'Cart exceeds available variant stock'; end if;

  if normalized_coupon is not null then
    select q.coupon_code, q.store_discounts into quoted_coupon_code, quoted_store_discounts
      from public.get_marketplace_coupon_quote(cart_key, normalized_coupon) q;
  end if;
  for seller in
    select distinct s.id, s.name from public.buyer_cart_items i
    join public.marketplace_products p on p.id = i.product_id join public.stores s on s.id = p.store_id
    where i.cart_id = cart_key order by s.id
  loop
    seller_discount := coalesce((quoted_store_discounts ->> seller.id::text)::bigint, 0);
    insert into public.seller_purchase_orders (buyer_id, store_id, store_name, delivery_recipient_name, delivery_postal_code,
      delivery_street, delivery_number, delivery_complement, delivery_district, delivery_city, delivery_state_code, delivery_reference,
      coupon_code, coupon_discount_cents)
    values ((select auth.uid()), seller.id, seller.name, shipping.recipient_name, shipping.postal_code, shipping.street,
      shipping.number, shipping.complement, shipping.district, shipping.city, shipping.state_code, shipping.reference,
      quoted_coupon_code, seller_discount)
    returning id into new_order;
    insert into public.seller_purchase_order_items (order_id, product_id, variant_id, variant_options, product_name, unit_price_brl, quantity)
      select new_order, p.id, i.variant_id, i.variant_options, i.product_name, i.price_brl, i.quantity
      from public.buyer_cart_items i join public.marketplace_products p on p.id = i.product_id
      where i.cart_id = cart_key and p.store_id = seller.id;
    select sum(i.quantity), string_agg(i.product_name, ', ' order by i.product_name)
      into total_quantity, product_summary from public.buyer_cart_items i
      join public.marketplace_products p on p.id = i.product_id where i.cart_id = cart_key and p.store_id = seller.id;
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

revoke all on function public.get_marketplace_coupon_quote(uuid, text), public.preview_marketplace_coupon(text),
  public.create_orders_from_cart(uuid, text) from public, anon;
grant execute on function public.preview_marketplace_coupon(text), public.create_orders_from_cart(uuid, text) to authenticated;

create or replace function public.create_seller_order_payment(p_order_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  order_row public.seller_purchase_orders%rowtype;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
  subtotal_cents bigint;
  discounted_subtotal_cents bigint;
  calculated_total bigint;
  item_row record;
  current_product_price numeric(12, 2);
  current_product_price_mode text;
  current_product_listing_type text;
  current_product_status text;
  current_product_store_id uuid;
  current_variant_price numeric(12, 2);
  current_variant_options jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception using errcode = '42501', message = 'Service role required'; end if;
  select o.* into order_row from public.seller_purchase_orders o where o.id = p_order_id and o.buyer_id = p_buyer_id and o.status = 'accepted'
    and o.shipping_quote_status = 'accepted' for update;
  if not found or not exists (select 1 from public.store_payment_connections c where c.store_id = order_row.store_id)
    or not exists (select 1 from public.stores s where s.id = order_row.store_id and s.status = 'published') then
    raise exception using errcode = '22023', message = 'Seller payment account is unavailable';
  end if;
  select p.* into existing from public.seller_order_payments p where p.order_id = p_order_id and p.status in ('creating', 'pending') for update;
  if found then return query select existing.id, existing.status, existing.total_cents, existing.marketplace_fee_cents,
    existing.provider_order_id, existing.checkout_url, existing.store_id; return; end if;
  if exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id
    and p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')) then
    raise exception using errcode = '22023', message = 'Order has already been charged';
  end if;
  for item_row in select i.product_id, i.variant_id, i.variant_options, i.unit_price_brl
    from public.seller_purchase_order_items i where i.order_id = p_order_id
    order by i.product_id, i.variant_id
  loop
    select p.price_brl, p.price_mode, p.listing_type, p.catalog_status, p.store_id
      into current_product_price, current_product_price_mode, current_product_listing_type, current_product_status, current_product_store_id
      from public.marketplace_products p where p.id = item_row.product_id for update;
    if not found or current_product_store_id <> order_row.store_id or current_product_price_mode <> 'fixed'
      or current_product_listing_type <> 'physical' or current_product_status <> 'published' then
      raise exception using errcode = '22023', message = 'Product is unavailable for payment';
    end if;
    if item_row.variant_id is not null then
      select v.price_brl, v.variant_options into current_variant_price, current_variant_options
        from public.marketplace_product_variants v
        where v.id = item_row.variant_id and v.product_id = item_row.product_id for update;
      if not found or current_variant_price is distinct from item_row.unit_price_brl
        or current_variant_options is distinct from item_row.variant_options then
        raise exception using errcode = '22023', message = 'Accepted variant price has changed';
      end if;
    elsif exists (select 1 from public.marketplace_product_variants v where v.product_id = item_row.product_id)
      or current_product_price is distinct from item_row.unit_price_brl then
      raise exception using errcode = '22023', message = 'Accepted product price has changed';
    end if;
  end loop;
  select sum(round(i.unit_price_brl * 100)::bigint * i.quantity)::bigint into subtotal_cents
    from public.seller_purchase_order_items i where i.order_id = p_order_id;
  discounted_subtotal_cents := subtotal_cents - order_row.coupon_discount_cents;
  calculated_total := discounted_subtotal_cents + order_row.shipping_cost_cents;
  if subtotal_cents is null or discounted_subtotal_cents < 1 or calculated_total < 1 or p_marketplace_fee_cents is null
    or p_marketplace_fee_cents < 0 or p_marketplace_fee_cents >= discounted_subtotal_cents then
    raise exception using errcode = '22023', message = 'Invalid payment amount or marketplace fee';
  end if;
  insert into public.seller_order_payments (order_id, buyer_id, store_id, total_cents, marketplace_fee_cents, shipping_cents)
    values (p_order_id, p_buyer_id, order_row.store_id, calculated_total, p_marketplace_fee_cents, order_row.shipping_cost_cents)
    returning id into next_payment_id;
  perform set_config('virapeca.internal_stock_adjustment', 'on', true);
  for item_row in select i.product_id, i.variant_id, sum(i.quantity)::integer as quantity
    from public.seller_purchase_order_items i where i.order_id = p_order_id
    group by i.product_id, i.variant_id order by i.product_id, i.variant_id
  loop
    perform public.reserve_seller_order_product_stock(next_payment_id, item_row.product_id, item_row.variant_id, item_row.quantity);
  end loop;
  perform set_config('virapeca.internal_stock_adjustment', 'off', true);
  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;
