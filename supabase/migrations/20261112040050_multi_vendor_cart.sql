create table public.buyer_carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buyer_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.buyer_carts (id) on delete cascade,
  product_id uuid not null references public.marketplace_products (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  store_name text not null,
  product_name text not null,
  price_brl numeric(12, 2) not null check (price_brl > 0),
  quantity smallint not null check (quantity between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table public.seller_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  store_name text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  maker_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seller_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.seller_purchase_orders (id) on delete cascade,
  product_id uuid not null references public.marketplace_products (id) on delete restrict,
  product_name text not null,
  unit_price_brl numeric(12, 2) not null check (unit_price_brl > 0),
  quantity smallint not null check (quantity between 1 and 100),
  created_at timestamptz not null default now()
);

create index buyer_cart_items_cart on public.buyer_cart_items (cart_id);
create index seller_purchase_orders_buyer_recent on public.seller_purchase_orders (buyer_id, created_at desc);
create index seller_purchase_orders_store_recent on public.seller_purchase_orders (store_id, created_at desc);
create index seller_purchase_order_items_order on public.seller_purchase_order_items (order_id);

alter table public.buyer_carts enable row level security;
alter table public.buyer_cart_items enable row level security;
alter table public.seller_purchase_orders enable row level security;
alter table public.seller_purchase_order_items enable row level security;
revoke all on public.buyer_carts, public.buyer_cart_items, public.seller_purchase_orders, public.seller_purchase_order_items from anon, authenticated;
grant select on public.buyer_carts, public.buyer_cart_items, public.seller_purchase_orders, public.seller_purchase_order_items to authenticated;

create policy "Buyers can read their own cart" on public.buyer_carts for select to authenticated
  using (buyer_id = (select auth.uid()));
create policy "Buyers can read their own cart items" on public.buyer_cart_items for select to authenticated
  using (exists (select 1 from public.buyer_carts c where c.id = cart_id and c.buyer_id = (select auth.uid())));
create policy "Buyers can read their own orders" on public.seller_purchase_orders for select to authenticated
  using (buyer_id = (select auth.uid()));
create policy "Makers can read orders for their store" on public.seller_purchase_orders for select to authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );
create policy "Order participants can read order items" on public.seller_purchase_order_items for select to authenticated
  using (exists (
    select 1 from public.seller_purchase_orders o
    where o.id = order_id and (o.buyer_id = (select auth.uid()) or exists (
      select 1 from public.stores s join public.user_roles r on r.user_id = s.owner_user_id
      where s.id = o.store_id and s.owner_user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
    ))
  ));

create function public.add_product_to_cart(p_product_id uuid, p_quantity smallint default 1)
returns void language plpgsql security definer set search_path = '' as $$
declare cart_key uuid; added_count integer;
begin
  if (select auth.uid()) is null or p_quantity is null or p_quantity not between 1 and 100
     or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '22023', message = 'Invalid cart item';
  end if;
  if not exists (
    select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
    where p.id = p_product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'
  ) then raise exception using errcode = '22023', message = 'Product is not available for cart purchase'; end if;
  insert into public.buyer_carts (buyer_id) values ((select auth.uid()))
    on conflict (buyer_id) do update set updated_at = now() returning id into cart_key;
  insert into public.buyer_cart_items (cart_id, product_id, store_id, store_name, product_name, price_brl, quantity)
    select cart_key, p.id, s.id, s.name, p.name, p.price_brl, p_quantity
    from public.marketplace_products p join public.stores s on s.id = p.store_id where p.id = p_product_id
    on conflict (cart_id, product_id) do update
      set quantity = public.buyer_cart_items.quantity + excluded.quantity, store_id = excluded.store_id,
          store_name = excluded.store_name, product_name = excluded.product_name, price_brl = excluded.price_brl, updated_at = now()
      where public.buyer_cart_items.quantity + excluded.quantity <= 100;
  get diagnostics added_count = row_count;
  if added_count = 0 then raise exception using errcode = '22023', message = 'Cart quantity limit exceeded'; end if;
end; $$;

create function public.set_cart_item_quantity(p_item_id uuid, p_quantity smallint)
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
    product_name = coalesce((select p.name from public.marketplace_products p where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed'), i.product_name),
    store_name = coalesce((select s.name from public.marketplace_products p join public.stores s on s.id = p.store_id where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.store_name),
    store_id = coalesce((select p.store_id from public.marketplace_products p join public.stores s on s.id = p.store_id where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.store_id),
    price_brl = coalesce((select p.price_brl from public.marketplace_products p join public.stores s on s.id = p.store_id where p.id = i.product_id and p.catalog_status = 'published' and p.price_mode = 'fixed' and s.status = 'published'), i.price_brl),
    updated_at = now()
    where i.id = p_item_id and i.cart_id = cart_key;
  if not found then raise exception using errcode = '42501', message = 'Cart item not found'; end if;
end; $$;

create function public.remove_cart_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare cart_key uuid;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select c.id into cart_key from public.buyer_carts c join public.buyer_cart_items i on i.cart_id = c.id
    where i.id = p_item_id and c.buyer_id = (select auth.uid()) for update of c;
  if cart_key is not null then delete from public.buyer_cart_items where id = p_item_id and cart_id = cart_key; end if;
end; $$;

create function public.create_orders_from_cart()
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare cart_key uuid; seller record; new_order uuid; total_quantity integer; product_summary text;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;
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
    insert into public.seller_purchase_orders (buyer_id, store_id, store_name)
      values ((select auth.uid()), seller.id, seller.name) returning id into new_order;
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
end; $$;

create function public.respond_to_seller_purchase_order(p_order_id uuid, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or p_response not in ('accept', 'decline') then
    raise exception using errcode = '22023', message = 'Invalid order response';
  end if;
  update public.seller_purchase_orders o
    set status = case when p_response = 'accept' then 'accepted' else 'declined' end,
        maker_read_at = coalesce(maker_read_at, now()), updated_at = now()
    from public.stores s
    where o.id = p_order_id and s.id = o.store_id and s.owner_user_id = (select auth.uid()) and s.status = 'published'
      and o.status = 'pending'
      and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role);
  if not found then raise exception using errcode = '42501', message = 'Order is not available to this maker'; end if;
end; $$;

create function public.mark_seller_order_read(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.seller_purchase_orders o set maker_read_at = now()
    from public.stores s where o.id = p_order_id and s.id = o.store_id and s.owner_user_id = (select auth.uid())
      and o.maker_read_at is null
      and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role);
end; $$;

revoke all on function public.add_product_to_cart(uuid, smallint), public.set_cart_item_quantity(uuid, smallint), public.remove_cart_item(uuid), public.create_orders_from_cart(), public.respond_to_seller_purchase_order(uuid, text), public.mark_seller_order_read(uuid) from public, anon;
grant execute on function public.add_product_to_cart(uuid, smallint), public.set_cart_item_quantity(uuid, smallint), public.remove_cart_item(uuid), public.create_orders_from_cart(), public.respond_to_seller_purchase_order(uuid, text), public.mark_seller_order_read(uuid) to authenticated;

alter table public.store_notification_deliveries alter column request_id drop not null;
alter table public.store_notification_deliveries add column order_id uuid references public.seller_purchase_orders (id) on delete cascade;
alter table public.store_notification_deliveries add constraint store_notification_delivery_parent_check check ((request_id is null) <> (order_id is null));
alter table public.store_notification_deliveries drop constraint store_notification_deliveries_request_id_channel_key;
create unique index store_notification_delivery_request_channel on public.store_notification_deliveries (request_id, channel) where request_id is not null;
create unique index store_notification_delivery_order_channel on public.store_notification_deliveries (order_id, channel) where order_id is not null;
drop policy "Makers can read delivery status for their own requests" on public.store_notification_deliveries;
create policy "Makers can read delivery status for their requests and orders" on public.store_notification_deliveries for select to authenticated
  using (
    (request_id is not null and exists (
      select 1 from public.product_quote_requests q join public.stores s on s.id = q.store_id
      where q.id = store_notification_deliveries.request_id and s.owner_user_id = (select auth.uid())
    )) or (order_id is not null and exists (
      select 1 from public.seller_purchase_orders o join public.stores s on s.id = o.store_id
      where o.id = store_notification_deliveries.order_id and s.owner_user_id = (select auth.uid())
    ) and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role))
  );

create or replace function public.retry_store_notification_delivery(delivery_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_notification_deliveries d
    where d.id = delivery_id and d.status = 'failed' and (
      (d.request_id is not null and exists (select 1 from public.product_quote_requests q join public.stores s on s.id = q.store_id where q.id = d.request_id and s.owner_user_id = (select auth.uid())))
      or (d.order_id is not null and exists (select 1 from public.seller_purchase_orders o join public.stores s on s.id = o.store_id where o.id = d.order_id and s.owner_user_id = (select auth.uid())))
    )
  ) or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role) then
    raise exception using errcode = '42501', message = 'Delivery cannot be retried';
  end if;
  update public.store_notification_deliveries set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
    where id = delivery_id and status = 'failed';
end; $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'seller_purchase_orders') then
      alter publication supabase_realtime add table public.seller_purchase_orders;
    end if;
  end if;
end; $$;
