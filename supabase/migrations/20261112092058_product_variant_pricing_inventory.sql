create table public.marketplace_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products (id) on delete cascade,
  variant_options jsonb not null check (jsonb_typeof(variant_options) = 'object'),
  price_brl numeric(12, 2) not null check (price_brl > 0),
  stock_quantity integer check (stock_quantity is null or stock_quantity between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, variant_options),
  unique (id, product_id)
);

create index marketplace_product_variants_product on public.marketplace_product_variants (product_id);

create function public.guard_maker_product_variant_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('virapeca.internal_stock_adjustment', true), '') = 'on' then return new; end if;
  if exists (select 1 from public.seller_order_payment_variant_reservations r
    where r.variant_id = old.id and r.released_at is null and r.fulfilled_at is null) then
    raise exception using errcode = '22023', message = 'Variant is reserved by an active checkout';
  end if;
  return new;
end;
$$;

create trigger guard_maker_product_variant_change_before_update
  before update of price_brl, stock_quantity on public.marketplace_product_variants
  for each row execute function public.guard_maker_product_variant_change();

create function public.guard_parent_product_variant_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('virapeca.internal_stock_adjustment', true), '') <> 'on'
    and exists (select 1 from public.marketplace_product_variants v where v.product_id = old.id) then
    raise exception using errcode = '22023', message = 'Update price and stock through the product variants';
  end if;
  return new;
end;
$$;

create trigger guard_parent_product_variant_change_before_update
  before update of price_brl, stock_quantity, fulfillment_mode, price_mode, listing_type, product_properties on public.marketplace_products
  for each row execute function public.guard_parent_product_variant_change();

alter table public.buyer_cart_items add column variant_id uuid;
alter table public.buyer_cart_items add constraint buyer_cart_items_variant_product_fk
  foreign key (variant_id, product_id) references public.marketplace_product_variants (id, product_id) on delete restrict;
alter table public.seller_purchase_order_items
  add column variant_id uuid,
  add column variant_options jsonb not null default '{}'::jsonb check (jsonb_typeof(variant_options) = 'object');
alter table public.seller_purchase_order_items add constraint seller_purchase_order_items_variant_product_fk
  foreign key (variant_id, product_id) references public.marketplace_product_variants (id, product_id) on delete restrict;
alter table public.product_quote_requests add column variant_id uuid;
alter table public.product_quote_requests add constraint product_quote_requests_variant_product_fk
  foreign key (variant_id, product_id) references public.marketplace_product_variants (id, product_id) on delete restrict;

create table public.seller_order_payment_variant_reservations (
  payment_id uuid not null references public.seller_order_payments (id) on delete cascade,
  product_id uuid not null,
  variant_id uuid not null,
  quantity integer not null check (quantity > 0),
  released_at timestamptz,
  fulfilled_at timestamptz,
  check (released_at is null or fulfilled_at is null),
  primary key (payment_id, variant_id),
  foreign key (variant_id, product_id) references public.marketplace_product_variants (id, product_id) on delete restrict
);
alter table public.seller_order_payment_variant_reservations enable row level security;
revoke all on public.seller_order_payment_variant_reservations from public, anon, authenticated;
create index seller_order_variant_reservations_variant_product
  on public.seller_order_payment_variant_reservations (variant_id, product_id);
create index seller_order_variant_reservations_active_product
  on public.seller_order_payment_variant_reservations (product_id)
  where released_at is null and fulfilled_at is null;

alter table public.marketplace_product_variants enable row level security;
revoke all on public.marketplace_product_variants from public, anon, authenticated;
grant select on public.marketplace_product_variants to anon, authenticated;
create policy "Anyone can read variants for published products" on public.marketplace_product_variants
  for select to anon, authenticated using (exists (
    select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
    where p.id = product_id and p.catalog_status = 'published' and s.status = 'published'
  ));
create policy "Makers can read variants for their products" on public.marketplace_product_variants
  for select to authenticated using (exists (
    select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
    where p.id = product_id and s.owner_user_id = (select auth.uid())
  ));
create policy "Marketplace admins can read product variants" on public.marketplace_product_variants
  for select to authenticated using ((select public.is_catalog_admin()));

create function public.save_maker_product_variants(p_product_id uuid, p_variants jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.marketplace_products%rowtype;
  option_count integer;
  expected_count integer := 1;
  total_stock integer;
  minimum_price numeric(12, 2);
begin
  if (select auth.uid()) is null or jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid product variants';
  end if;
  select p.* into product_row from public.marketplace_products p
    join public.stores s on s.id = p.store_id
    where p.id = p_product_id and s.owner_user_id = (select auth.uid())
      and p.listing_type = 'physical' and p.price_mode = 'fixed' and p.catalog_status in ('draft', 'published')
      and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    for update of p;
  if not found then raise exception using errcode = '42501', message = 'Product is not available to this maker'; end if;

  with recursive option_groups as (
    select row_number() over (order by option.key)::integer as position, option.key, option.value as choices
    from jsonb_each(coalesce(product_row.product_properties -> 'variant_options', '{}'::jsonb)) option
  ), combinations(position, selected) as (
    select 0, '{}'::jsonb
    union all
    select combinations.position + 1, combinations.selected || jsonb_build_object(groups.key, choice.value)
    from combinations join option_groups groups on groups.position = combinations.position + 1
    cross join lateral jsonb_array_elements_text(groups.choices) choice(value)
  )
  select count(*)::integer into expected_count from combinations
    where position = (select count(*) from option_groups);
  select count(*)::integer into option_count from (
    select distinct item.value -> 'options'
    from jsonb_array_elements(p_variants) item(value)
  ) supplied;
  if option_count <> expected_count or exists (
    select 1 from jsonb_array_elements(p_variants) item(value)
    where jsonb_typeof(item.value -> 'options') <> 'object'
      or not public.valid_product_variant_options(
        coalesce(product_row.product_properties -> 'variant_options', '{}'::jsonb), item.value -> 'options')
      or coalesce(item.value ->> 'priceBrl', '') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$'
      or (product_row.fulfillment_mode = 'ready_to_ship'
        and coalesce(item.value ->> 'stockQuantity', '') !~ '^[0-9]{1,7}$')
      or (product_row.fulfillment_mode = 'made_to_order'
        and item.value -> 'stockQuantity' <> 'null'::jsonb)
  ) then raise exception using errcode = '22023', message = 'Product variants must cover each option combination'; end if;

  select min((item.value ->> 'priceBrl')::numeric), sum(coalesce((nullif(item.value ->> 'stockQuantity', ''))::integer, 0))::integer
    into minimum_price, total_stock from jsonb_array_elements(p_variants) item(value);
  if minimum_price <= 0 or minimum_price > 999999999
    or (product_row.fulfillment_mode = 'ready_to_ship' and total_stock not between 0 and 1000000) then
    raise exception using errcode = '22023', message = 'Invalid product variant price or stock';
  end if;

  if exists (select 1 from public.seller_order_payment_variant_reservations r
    where r.product_id = p_product_id and r.released_at is null and r.fulfilled_at is null) then
    raise exception using errcode = '22023', message = 'Product variants are reserved by an active checkout';
  end if;

  insert into public.marketplace_product_variants (product_id, variant_options, price_brl, stock_quantity)
    select p_product_id, item.value -> 'options', (item.value ->> 'priceBrl')::numeric,
      case when product_row.fulfillment_mode = 'ready_to_ship' then (item.value ->> 'stockQuantity')::integer else null end
    from jsonb_array_elements(p_variants) item(value)
    on conflict (product_id, variant_options) do update set
      price_brl = excluded.price_brl, stock_quantity = excluded.stock_quantity, updated_at = now();

  delete from public.marketplace_product_variants v where v.product_id = p_product_id
    and not exists (select 1 from jsonb_array_elements(p_variants) item(value) where item.value -> 'options' = v.variant_options);

  perform set_config('virapeca.internal_stock_adjustment', 'on', true);
  update public.marketplace_products set price_brl = minimum_price,
    stock_quantity = case when product_row.fulfillment_mode = 'ready_to_ship' then total_stock else null end,
    updated_at = now()
    where id = p_product_id;
  perform set_config('virapeca.internal_stock_adjustment', 'off', true);
end;
$$;

revoke all on function public.save_maker_product_variants(uuid, jsonb) from public, anon;
grant execute on function public.save_maker_product_variants(uuid, jsonb) to authenticated;

create or replace function public.validate_product_stock_quantity()
returns trigger language plpgsql set search_path = '' as $$
declare
  product_stock integer;
  variant_stock integer;
  product_price numeric(12, 2);
  product_price_mode text;
  product_listing_type text;
  product_catalog_status text;
  variant_price numeric(12, 2);
  variant_options jsonb;
  product_quantity integer := 0;
  variant_quantity integer := 0;
begin
  if tg_table_name = 'product_quote_requests' and new.request_type <> 'purchase' then return new; end if;
  select p.stock_quantity, p.price_brl, p.price_mode, p.listing_type, p.catalog_status
    into product_stock, product_price, product_price_mode, product_listing_type, product_catalog_status
    from public.marketplace_products p where p.id = new.product_id for update;
  if not found then raise exception using errcode = '22023', message = 'Product is unavailable'; end if;
  if new.variant_id is not null then
    select v.stock_quantity, v.price_brl, v.variant_options into variant_stock, variant_price, variant_options
      from public.marketplace_product_variants v
      where v.id = new.variant_id and v.product_id = new.product_id for update;
    if not found then raise exception using errcode = '22023', message = 'Product variant is unavailable'; end if;
  end if;
  if tg_table_name = 'seller_purchase_order_items' then
    if product_price_mode <> 'fixed' or product_listing_type <> 'physical' or product_catalog_status <> 'published' then
      raise exception using errcode = '22023', message = 'Product is unavailable for checkout';
    end if;
    if new.variant_id is not null then
      if variant_options is distinct from new.variant_options or variant_price is distinct from new.unit_price_brl then
        raise exception using errcode = '22023', message = 'Product variant price changed';
      end if;
    elsif exists (select 1 from public.marketplace_product_variants v where v.product_id = new.product_id)
      or product_price is distinct from new.unit_price_brl then
      raise exception using errcode = '22023', message = 'Product price changed';
    end if;
  end if;
  if tg_table_name = 'buyer_cart_items' then
    select coalesce(sum(i.quantity), 0)::integer into product_quantity from public.buyer_cart_items i
      where i.cart_id = new.cart_id and i.product_id = new.product_id and (tg_op <> 'UPDATE' or i.id <> new.id);
    if new.variant_id is not null then
      select coalesce(sum(i.quantity), 0)::integer into variant_quantity from public.buyer_cart_items i
        where i.cart_id = new.cart_id and i.variant_id = new.variant_id and (tg_op <> 'UPDATE' or i.id <> new.id);
    end if;
  elsif tg_table_name = 'seller_purchase_order_items' then
    select coalesce(sum(i.quantity), 0)::integer into product_quantity from public.seller_purchase_order_items i
      where i.order_id = new.order_id and i.product_id = new.product_id;
    if new.variant_id is not null then
      select coalesce(sum(i.quantity), 0)::integer into variant_quantity from public.seller_purchase_order_items i
        where i.order_id = new.order_id and i.variant_id = new.variant_id;
    end if;
  end if;
  if product_stock is not null and product_quantity + new.quantity > product_stock then
    raise exception using errcode = '22023', message = 'Requested quantity exceeds available product stock';
  end if;
  if variant_stock is not null and variant_quantity + new.quantity > variant_stock then
    raise exception using errcode = '22023', message = 'Requested quantity exceeds available variant stock';
  end if;
  return new;
end;
$$;

create function public.reserve_seller_order_product_stock(p_payment_id uuid, p_product_id uuid, p_variant_id uuid, p_quantity integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  product_stock integer;
  variant_stock integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_quantity is null or p_quantity < 1 then
    raise exception using errcode = '42501', message = 'Invalid stock reservation';
  end if;
  select p.stock_quantity into product_stock from public.marketplace_products p where p.id = p_product_id for update;
  if not found then raise exception using errcode = '22023', message = 'Product is unavailable'; end if;
  if p_variant_id is not null then
    select v.stock_quantity into variant_stock from public.marketplace_product_variants v
      where v.id = p_variant_id and v.product_id = p_product_id for update;
    if not found then raise exception using errcode = '22023', message = 'Product variant is unavailable'; end if;
  elsif exists (select 1 from public.marketplace_product_variants v where v.product_id = p_product_id) then
    raise exception using errcode = '22023', message = 'A product variant must be selected';
  end if;

  if product_stock is not null then
    if product_stock < p_quantity then raise exception using errcode = '22023', message = 'Insufficient product stock'; end if;
    update public.marketplace_products set stock_quantity = stock_quantity - p_quantity, updated_at = now() where id = p_product_id;
    insert into public.seller_order_payment_stock_reservations (payment_id, product_id, quantity)
      values (p_payment_id, p_product_id, p_quantity)
      on conflict (payment_id, product_id) do update
        set quantity = public.seller_order_payment_stock_reservations.quantity + excluded.quantity;
  end if;
  if p_variant_id is not null then
    if variant_stock is not null then
      if variant_stock < p_quantity then raise exception using errcode = '22023', message = 'Insufficient variant stock'; end if;
      update public.marketplace_product_variants set stock_quantity = stock_quantity - p_quantity, updated_at = now() where id = p_variant_id;
    end if;
    insert into public.seller_order_payment_variant_reservations (payment_id, product_id, variant_id, quantity)
      values (p_payment_id, p_product_id, p_variant_id, p_quantity);
  end if;
end;
$$;

revoke all on function public.reserve_seller_order_product_stock(uuid, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_seller_order_product_stock(uuid, uuid, uuid, integer) to service_role;

drop function public.add_product_to_cart(uuid, smallint, jsonb);
create function public.add_product_to_cart(
  p_product_id uuid, p_quantity smallint default 1, p_variant_options jsonb default '{}'::jsonb, p_variant_id uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cart_key uuid;
  added_count integer;
  product_row public.marketplace_products%rowtype;
  store_row public.stores%rowtype;
  variant_row public.marketplace_product_variants%rowtype;
  selected_price numeric(12, 2);
begin
  if (select auth.uid()) is null or p_quantity is null or p_quantity not between 1 and 100
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '22023', message = 'Invalid cart item';
  end if;
  select p.* into product_row from public.marketplace_products p join public.stores s on s.id = p.store_id
    where p.id = p_product_id and p.listing_type = 'physical' and p.catalog_status = 'published'
      and p.price_mode = 'fixed' and s.status = 'published';
  if not found then raise exception using errcode = '22023', message = 'Product is not available for cart purchase'; end if;
  if not public.valid_product_variant_options(coalesce(product_row.product_properties -> 'variant_options', '{}'::jsonb), p_variant_options) then
    raise exception using errcode = '22023', message = 'Invalid product variant';
  end if;
  select v.* into variant_row from public.marketplace_product_variants v
    where v.product_id = p_product_id and v.variant_options = p_variant_options for update;
  if found then
    if p_variant_id is distinct from variant_row.id then raise exception using errcode = '22023', message = 'Selected variant changed'; end if;
    if variant_row.stock_quantity = 0 then raise exception using errcode = '22023', message = 'Selected variant is unavailable'; end if;
    selected_price := variant_row.price_brl;
  else
    if p_variant_id is not null or exists (select 1 from public.marketplace_product_variants v where v.product_id = p_product_id) then
      raise exception using errcode = '22023', message = 'Selected product variant is unavailable';
    end if;
    selected_price := product_row.price_brl;
  end if;
  select s.* into store_row from public.stores s where s.id = product_row.store_id;
  insert into public.buyer_carts (buyer_id) values ((select auth.uid()))
    on conflict (buyer_id) do update set updated_at = now() returning id into cart_key;
  insert into public.buyer_cart_items (cart_id, product_id, variant_id, store_id, store_name, product_name, price_brl, quantity, variant_options)
    values (cart_key, product_row.id, variant_row.id, store_row.id, store_row.name,
      public.product_variant_product_name(product_row.name, p_variant_options), selected_price, p_quantity, p_variant_options)
    on conflict (cart_id, product_id, variant_options) do update
      set quantity = public.buyer_cart_items.quantity + excluded.quantity, variant_id = excluded.variant_id,
        store_id = excluded.store_id, store_name = excluded.store_name, product_name = excluded.product_name,
        price_brl = excluded.price_brl, updated_at = now()
      where public.buyer_cart_items.quantity + excluded.quantity <= 100;
  get diagnostics added_count = row_count;
  if added_count = 0 then raise exception using errcode = '22023', message = 'Cart quantity limit exceeded'; end if;
end;
$$;

create or replace function public.set_cart_item_quantity(p_item_id uuid, p_quantity smallint)
returns void language plpgsql security definer set search_path = '' as $$
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
    store_name = coalesce((select s.name from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.store_name),
    store_id = coalesce((select p.store_id from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.store_id),
    price_brl = coalesce((select v.price_brl from public.marketplace_product_variants v where v.id = i.variant_id and v.product_id = i.product_id),
      (select p.price_brl from public.marketplace_products p join public.stores s on s.id = p.store_id
        where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.price_brl),
    updated_at = now()
    where i.id = p_item_id and i.cart_id = cart_key;
  if not found then raise exception using errcode = '42501', message = 'Cart item not found'; end if;
end;
$$;

create or replace function public.create_orders_from_cart(p_buyer_address_id uuid)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  cart_key uuid;
  seller record;
  new_order uuid;
  total_quantity integer;
  product_summary text;
  shipping record;
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

  for seller in
    select distinct s.id, s.name from public.buyer_cart_items i
    join public.marketplace_products p on p.id = i.product_id join public.stores s on s.id = p.store_id
    where i.cart_id = cart_key order by s.id
  loop
    insert into public.seller_purchase_orders (buyer_id, store_id, store_name, delivery_recipient_name, delivery_postal_code,
      delivery_street, delivery_number, delivery_complement, delivery_district, delivery_city, delivery_state_code, delivery_reference)
    values ((select auth.uid()), seller.id, seller.name, shipping.recipient_name, shipping.postal_code, shipping.street,
      shipping.number, shipping.complement, shipping.district, shipping.city, shipping.state_code, shipping.reference)
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

revoke all on function public.add_product_to_cart(uuid, smallint, jsonb, uuid),
  public.set_cart_item_quantity(uuid, smallint), public.create_orders_from_cart(uuid) from public, anon;
grant execute on function public.add_product_to_cart(uuid, smallint, jsonb, uuid),
  public.set_cart_item_quantity(uuid, smallint), public.create_orders_from_cart(uuid) to authenticated;

drop policy "Buyers can request published physical products" on public.product_quote_requests;
create policy "Buyers can request published physical products" on public.product_quote_requests
  for insert to authenticated with check (
    buyer_id = (select auth.uid()) and status = 'pending' and maker_read_at is null
    and (due_date is null or due_date >= current_date)
    and exists (
      select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.id = product_quote_requests.product_id and p.store_id = product_quote_requests.store_id
        and p.catalog_status = 'published' and s.status = 'published'
        and product_quote_requests.product_name = p.name and product_quote_requests.store_name = s.name
        and (
          (product_quote_requests.request_type = 'quote' and p.price_mode in ('quote', 'from')
            and product_quote_requests.unit_price_brl is null and product_quote_requests.variant_id is null)
          or (product_quote_requests.request_type = 'purchase' and p.price_mode = 'fixed'
            and ((product_quote_requests.variant_id is null and not exists (
              select 1 from public.marketplace_product_variants v where v.product_id = p.id)
              and product_quote_requests.unit_price_brl = p.price_brl)
              or exists (select 1 from public.marketplace_product_variants v
                where v.id = product_quote_requests.variant_id and v.product_id = p.id
                  and v.variant_options = product_quote_requests.variant_options
                  and v.price_brl = product_quote_requests.unit_price_brl)))
        )
      )
  );

create or replace function public.validate_product_purchase_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare available_stock integer;
begin
  if new.request_type <> 'purchase' then return new; end if;
  if new.variant_id is not null then
    select v.stock_quantity into available_stock from public.marketplace_product_variants v
      where v.id = new.variant_id and v.product_id = new.product_id
        and v.variant_options = new.variant_options and v.price_brl = new.unit_price_brl for update;
  else
    if exists (select 1 from public.marketplace_product_variants v where v.product_id = new.product_id) then
      raise exception using errcode = '22023', message = 'Select an available product variant';
    end if;
    select p.stock_quantity into available_stock from public.marketplace_products p where p.id = new.product_id for update;
  end if;
  if not found then raise exception using errcode = '22023', message = 'Product variant or price is unavailable'; end if;
  if available_stock is not null and new.quantity > available_stock then
    raise exception using errcode = '22023', message = 'Requested quantity exceeds available stock';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_product_purchase_request(), public.guard_maker_product_variant_change(),
  public.guard_parent_product_variant_change()
  from public, anon, authenticated;

drop trigger validate_direct_purchase_stock_before_insert on public.product_quote_requests;
create trigger validate_direct_purchase_stock_before_insert
  before insert on public.product_quote_requests for each row execute function public.validate_product_purchase_request();

create or replace function public.create_seller_order_payment(p_order_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  order_row public.seller_purchase_orders%rowtype;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
  subtotal_cents bigint;
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
  select o.* into order_row from public.seller_purchase_orders o where o.id = p_order_id and o.buyer_id = p_buyer_id
    and o.status = 'accepted' and o.shipping_quote_status = 'accepted' for update;
  if not found then raise exception using errcode = '22023', message = 'Accepted order with shipping quote not found'; end if;
  if not exists (select 1 from public.store_payment_connections c where c.store_id = order_row.store_id)
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
  calculated_total := subtotal_cents + order_row.shipping_cost_cents;
  if subtotal_cents is null or subtotal_cents < 1 or calculated_total < 1 or p_marketplace_fee_cents is null
    or p_marketplace_fee_cents < 0 or p_marketplace_fee_cents >= subtotal_cents then
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

create or replace function public.create_product_purchase_payment(p_request_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  request_row public.product_quote_requests%rowtype;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
  calculated_total bigint;
  current_variant_price numeric(12, 2);
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception using errcode = '42501', message = 'Service role required'; end if;
  select q.* into request_row from public.product_quote_requests q
    where q.id = p_request_id and q.buyer_id = p_buyer_id and q.request_type = 'purchase' and q.status = 'accepted' for update;
  if not found then raise exception using errcode = '22023', message = 'Accepted product purchase not found'; end if;
  if not exists (select 1 from public.store_payment_connections c where c.store_id = request_row.store_id)
    or not exists (select 1 from public.stores s where s.id = request_row.store_id and s.status = 'published')
    or not exists (select 1 from public.marketplace_products p where p.id = request_row.product_id
      and p.store_id = request_row.store_id and p.listing_type = 'physical'
      and p.catalog_status = 'published' and p.price_mode = 'fixed') then
    raise exception using errcode = '22023', message = 'Seller payment account or product is unavailable';
  end if;
  select p.* into existing from public.seller_order_payments p
    where p.purchase_request_id = p_request_id and p.status in ('creating', 'pending') for update;
  if found then return query select existing.id, existing.status, existing.total_cents, existing.marketplace_fee_cents,
    existing.provider_order_id, existing.checkout_url, existing.store_id; return; end if;
  if exists (select 1 from public.seller_order_payments p where p.purchase_request_id = p_request_id
      and p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')) then
    raise exception using errcode = '22023', message = 'Product purchase has already been charged';
  end if;
  if request_row.variant_id is not null then
    select v.price_brl into current_variant_price from public.marketplace_product_variants v
      where v.id = request_row.variant_id and v.product_id = request_row.product_id
        and v.variant_options = request_row.variant_options for update;
    if not found or current_variant_price <> request_row.unit_price_brl then
      raise exception using errcode = '22023', message = 'Accepted variant price has changed';
    end if;
  elsif exists (select 1 from public.marketplace_product_variants v where v.product_id = request_row.product_id) then
    raise exception using errcode = '22023', message = 'Accepted product variant is unavailable';
  end if;
  calculated_total := round(request_row.unit_price_brl * 100)::bigint * request_row.quantity;
  if calculated_total < 1 or p_marketplace_fee_cents is null or p_marketplace_fee_cents < 0
    or p_marketplace_fee_cents >= calculated_total then
    raise exception using errcode = '22023', message = 'Invalid payment amount or marketplace fee';
  end if;
  insert into public.seller_order_payments (purchase_request_id, buyer_id, store_id, total_cents, marketplace_fee_cents)
    values (p_request_id, p_buyer_id, request_row.store_id, calculated_total, p_marketplace_fee_cents)
    returning id into next_payment_id;
  perform set_config('virapeca.internal_stock_adjustment', 'on', true);
  perform public.reserve_seller_order_product_stock(next_payment_id, request_row.product_id, request_row.variant_id, request_row.quantity);
  perform set_config('virapeca.internal_stock_adjustment', 'off', true);
  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;

create or replace function public.release_seller_order_variant_stock(p_payment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare reservation record; previous_adjustment text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception using errcode = '42501', message = 'Service role required'; end if;
  previous_adjustment := coalesce(current_setting('virapeca.internal_stock_adjustment', true), 'off');
  perform set_config('virapeca.internal_stock_adjustment', 'on', true);
  for reservation in select r.product_id, r.variant_id, r.quantity from public.seller_order_payment_variant_reservations r
    where r.payment_id = p_payment_id and r.released_at is null and r.fulfilled_at is null order by r.variant_id for update
  loop
    update public.marketplace_product_variants set stock_quantity = stock_quantity + reservation.quantity, updated_at = now()
      where id = reservation.variant_id and product_id = reservation.product_id;
    update public.seller_order_payment_variant_reservations set released_at = now()
      where payment_id = p_payment_id and variant_id = reservation.variant_id and released_at is null;
  end loop;
  perform set_config('virapeca.internal_stock_adjustment', previous_adjustment, true);
end;
$$;
revoke all on function public.release_seller_order_variant_stock(uuid) from public, anon, authenticated;
grant execute on function public.release_seller_order_variant_stock(uuid) to service_role;

create or replace function public.fail_seller_order_payment(p_payment_id uuid, p_status text, p_provider_status text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare reservation record;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_status not in ('failed', 'expired', 'cancelled') then
    raise exception using errcode = '42501', message = 'Invalid payment failure update';
  end if;
  update public.seller_order_payments set status = p_status, provider_status = left(p_provider_status, 80), updated_at = now()
    where id = p_payment_id and status in ('creating', 'pending');
  if found then
    perform set_config('virapeca.internal_stock_adjustment', 'on', true);
    for reservation in select r.product_id, r.quantity from public.seller_order_payment_stock_reservations r
      where r.payment_id = p_payment_id and r.released_at is null and r.fulfilled_at is null order by r.product_id for update
    loop
      update public.marketplace_products set stock_quantity = stock_quantity + reservation.quantity, updated_at = now()
        where id = reservation.product_id;
      update public.seller_order_payment_stock_reservations set released_at = now()
        where payment_id = p_payment_id and product_id = reservation.product_id and released_at is null;
    end loop;
    perform public.release_seller_order_variant_stock(p_payment_id);
    perform set_config('virapeca.internal_stock_adjustment', 'off', true);
  end if;
end;
$$;

create or replace function public.record_seller_order_payment_status(p_payment_id uuid, p_provider_order_id text, p_provider_status text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_status text; reservation record;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_status not in ('paid', 'partially_refunded', 'refunded', 'charged_back', 'pending', 'failed', 'expired', 'cancelled')
    or p_provider_status is null or char_length(p_provider_status) > 80 then
    raise exception using errcode = '42501', message = 'Invalid payment status update';
  end if;
  select p.status into current_status from public.seller_order_payments p where p.id = p_payment_id
    and p.provider_order_id = p_provider_order_id for update;
  if not found then raise exception using errcode = '22023', message = 'Payment status cannot be updated'; end if;
  if current_status = p_status then
    if p_status = 'charged_back' then update public.seller_order_payments set provider_status = p_provider_status, updated_at = now()
      where id = p_payment_id and provider_order_id = p_provider_order_id and provider_status is distinct from p_provider_status; end if;
    return;
  end if;
  if p_status in ('failed', 'expired', 'cancelled') then
    if current_status not in ('creating', 'pending') then raise exception using errcode = '22023', message = 'Payment status cannot be updated'; end if;
    perform public.fail_seller_order_payment(p_payment_id, p_status, p_provider_status);
  else
    update public.seller_order_payments set status = p_status, provider_status = p_provider_status, updated_at = now()
      where id = p_payment_id and provider_order_id = p_provider_order_id and (
        (p_status = 'pending' and current_status in ('creating', 'pending'))
        or (p_status = 'paid' and current_status in ('creating', 'pending', 'paid'))
        or (p_status = 'partially_refunded' and current_status in ('creating', 'pending', 'paid', 'partially_refunded'))
        or (p_status = 'refunded' and current_status in ('creating', 'pending', 'paid', 'partially_refunded'))
        or (p_status = 'charged_back' and current_status in ('creating', 'pending', 'paid', 'partially_refunded'))
      );
    if not found then raise exception using errcode = '22023', message = 'Payment status cannot be updated'; end if;
    if p_status in ('paid', 'partially_refunded', 'charged_back') then
      update public.seller_order_payment_stock_reservations set fulfilled_at = now()
        where payment_id = p_payment_id and released_at is null and fulfilled_at is null;
      update public.seller_order_payment_variant_reservations set fulfilled_at = now()
        where payment_id = p_payment_id and released_at is null and fulfilled_at is null;
    elsif p_status = 'refunded' and current_status <> 'paid' then
      perform set_config('virapeca.internal_stock_adjustment', 'on', true);
      for reservation in select r.product_id, r.quantity from public.seller_order_payment_stock_reservations r
        where r.payment_id = p_payment_id and r.released_at is null and r.fulfilled_at is null order by r.product_id for update
      loop
        update public.marketplace_products set stock_quantity = stock_quantity + reservation.quantity, updated_at = now()
          where id = reservation.product_id;
        update public.seller_order_payment_stock_reservations set released_at = now()
          where payment_id = p_payment_id and product_id = reservation.product_id and released_at is null;
      end loop;
      perform public.release_seller_order_variant_stock(p_payment_id);
      perform set_config('virapeca.internal_stock_adjustment', 'off', true);
    end if;
  end if;
end;
$$;

