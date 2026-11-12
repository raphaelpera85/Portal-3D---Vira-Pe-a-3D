create table public.seller_order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.seller_purchase_orders (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  total_cents bigint not null check (total_cents > 0),
  marketplace_fee_cents bigint not null check (marketplace_fee_cents >= 0 and marketplace_fee_cents < total_cents),
  status text not null default 'creating' check (status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded', 'failed', 'expired', 'cancelled')),
  provider_order_id text unique,
  checkout_url text,
  provider_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider_order_id is null) = (checkout_url is null))
);

create unique index seller_order_payment_one_active on public.seller_order_payments (order_id)
  where status in ('creating', 'pending');
create index seller_order_payments_buyer_recent on public.seller_order_payments (buyer_id, created_at desc);

create table public.seller_order_payment_stock_reservations (
  payment_id uuid not null references public.seller_order_payments (id) on delete cascade,
  product_id uuid not null references public.marketplace_products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  released_at timestamptz,
  fulfilled_at timestamptz,
  check (released_at is null or fulfilled_at is null),
  primary key (payment_id, product_id)
);

create function public.guard_reserved_maker_inventory()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('virapeca.internal_stock_adjustment', true), '') = 'on' then return new; end if;
  if exists (select 1 from public.seller_order_payment_stock_reservations r
    where r.product_id = old.id and r.released_at is null and r.fulfilled_at is null) then
    raise exception using errcode = '22023', message = 'Product stock is reserved by an active checkout';
  end if;
  return new;
end;
$$;

create trigger guard_reserved_maker_inventory_before_update
  before update of stock_quantity, fulfillment_mode on public.marketplace_products
  for each row execute function public.guard_reserved_maker_inventory();

alter table public.store_payment_connections add column refresh_started_at timestamptz;

create function public.claim_mercado_pago_token_refresh(p_store_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  update public.store_payment_connections set refresh_started_at = now()
    where store_id = p_store_id and (refresh_started_at is null or refresh_started_at < now() - interval '30 seconds');
  return found;
end;
$$;

create function public.complete_mercado_pago_token_refresh(p_store_id uuid, p_provider_user_id text,
  p_access_token_ciphertext text, p_refresh_token_ciphertext text, p_expires_in integer, p_scopes text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_expires_in is null or p_expires_in < 1
    or p_provider_user_id is null or p_access_token_ciphertext is null or p_refresh_token_ciphertext is null then
    raise exception using errcode = '42501', message = 'Invalid token refresh';
  end if;
  update public.store_payment_connections set provider_user_id = p_provider_user_id,
    access_token_ciphertext = p_access_token_ciphertext, refresh_token_ciphertext = p_refresh_token_ciphertext,
    token_expires_at = now() + make_interval(secs => p_expires_in), scopes = left(coalesce(p_scopes, scopes), 500),
    refresh_started_at = null, updated_at = now()
    where store_id = p_store_id and refresh_started_at > now() - interval '30 seconds';
  if not found then raise exception using errcode = '22023', message = 'Token refresh claim expired'; end if;
end;
$$;

create function public.release_mercado_pago_token_refresh(p_store_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  update public.store_payment_connections set refresh_started_at = null, updated_at = now()
    where store_id = p_store_id;
end;
$$;

alter table public.seller_order_payments enable row level security;
alter table public.seller_order_payment_stock_reservations enable row level security;
revoke all on public.seller_order_payments, public.seller_order_payment_stock_reservations from anon, authenticated;
grant select on public.seller_order_payments to authenticated;
create policy "Order participants can read payment status" on public.seller_order_payments for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or exists (select 1 from public.stores s join public.user_roles r on r.user_id = s.owner_user_id
      where s.id = store_id and s.owner_user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create function public.create_seller_order_payment(p_order_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  order_row public.seller_purchase_orders%rowtype;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
  calculated_total bigint;
  item_row record;
  available_stock integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  select o.* into order_row from public.seller_purchase_orders o
    where o.id = p_order_id and o.buyer_id = p_buyer_id and o.status = 'accepted' for update;
  if not found then raise exception using errcode = '22023', message = 'Accepted buyer order not found'; end if;
  if not exists (select 1 from public.store_payment_connections c where c.store_id = order_row.store_id)
    or not exists (select 1 from public.stores s where s.id = order_row.store_id and s.status = 'published') then
    raise exception using errcode = '22023', message = 'Seller payment account is unavailable';
  end if;
  select p.* into existing from public.seller_order_payments p
    where p.order_id = p_order_id and p.status in ('creating', 'pending') for update;
  if found then
    return query select existing.id, existing.status, existing.total_cents, existing.marketplace_fee_cents,
      existing.provider_order_id, existing.checkout_url, existing.store_id;
    return;
  end if;
  if exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id and p.status in ('paid', 'partially_refunded')) then
    raise exception using errcode = '22023', message = 'Order has already been paid';
  end if;
  if exists (select 1 from public.seller_order_payments p where p.order_id = p_order_id and p.status = 'refunded') then
    raise exception using errcode = '22023', message = 'Refunded order cannot be charged again';
  end if;

  select sum(round(i.unit_price_brl * 100)::bigint * i.quantity)::bigint into calculated_total
    from public.seller_purchase_order_items i where i.order_id = p_order_id;
  if calculated_total is null or calculated_total < 1 or p_marketplace_fee_cents is null
    or p_marketplace_fee_cents < 0 or p_marketplace_fee_cents >= calculated_total then
    raise exception using errcode = '22023', message = 'Invalid payment amount or marketplace fee';
  end if;
  insert into public.seller_order_payments (order_id, buyer_id, store_id, total_cents, marketplace_fee_cents)
    values (p_order_id, p_buyer_id, order_row.store_id, calculated_total, p_marketplace_fee_cents)
    returning id into next_payment_id;

  perform set_config('virapeca.internal_stock_adjustment', 'on', true);
  for item_row in
    select i.product_id, sum(i.quantity)::integer as quantity
      from public.seller_purchase_order_items i where i.order_id = p_order_id group by i.product_id order by i.product_id
  loop
    select p.stock_quantity into available_stock from public.marketplace_products p where p.id = item_row.product_id for update;
    if available_stock is not null then
      if available_stock < item_row.quantity then raise exception using errcode = '22023', message = 'Insufficient stock for payment'; end if;
      update public.marketplace_products set stock_quantity = stock_quantity - item_row.quantity, updated_at = now()
        where id = item_row.product_id;
      insert into public.seller_order_payment_stock_reservations (payment_id, product_id, quantity)
        values (next_payment_id, item_row.product_id, item_row.quantity);
    end if;
  end loop;
  perform set_config('virapeca.internal_stock_adjustment', 'off', true);

  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;

create function public.save_seller_order_payment_provider_order(p_payment_id uuid, p_provider_order_id text, p_checkout_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_provider_order_id is null or char_length(p_provider_order_id) > 100
    or p_checkout_url is null or char_length(p_checkout_url) > 2048 then
    raise exception using errcode = '42501', message = 'Invalid payment order update';
  end if;
  update public.seller_order_payments set provider_order_id = p_provider_order_id, checkout_url = p_checkout_url,
    status = 'pending', updated_at = now() where id = p_payment_id and status = 'creating'
    and provider_order_id is null and checkout_url is null;
  if not found and not exists (select 1 from public.seller_order_payments p where p.id = p_payment_id
    and p.provider_order_id = p_provider_order_id and p.checkout_url = p_checkout_url and p.status = 'pending') then
    raise exception using errcode = '22023', message = 'Payment order cannot be updated';
  end if;
end;
$$;

create function public.fail_seller_order_payment(p_payment_id uuid, p_status text, p_provider_status text default null)
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
    perform set_config('virapeca.internal_stock_adjustment', 'off', true);
  end if;
end;
$$;

create function public.record_seller_order_payment_status(p_payment_id uuid, p_provider_order_id text, p_provider_status text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_status text;
  reservation record;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_status not in ('paid', 'partially_refunded', 'refunded', 'pending', 'failed', 'expired', 'cancelled')
    or p_provider_status is null or char_length(p_provider_status) > 80 then
    raise exception using errcode = '42501', message = 'Invalid payment status update';
  end if;
  select p.status into current_status from public.seller_order_payments p where p.id = p_payment_id
    and p.provider_order_id = p_provider_order_id for update;
  if not found then raise exception using errcode = '22023', message = 'Payment status cannot be updated'; end if;
  if current_status = p_status then return; end if;
  if p_status in ('failed', 'expired', 'cancelled') then
    if current_status not in ('creating', 'pending') then
      raise exception using errcode = '22023', message = 'Payment status cannot be updated';
    end if;
    perform public.fail_seller_order_payment(p_payment_id, p_status, p_provider_status);
  else
    update public.seller_order_payments set status = p_status, provider_status = p_provider_status, updated_at = now()
      where id = p_payment_id and provider_order_id = p_provider_order_id and (
        (p_status = 'pending' and current_status in ('creating', 'pending'))
        or (p_status = 'paid' and current_status in ('creating', 'pending', 'paid'))
        or (p_status = 'partially_refunded' and current_status in ('creating', 'pending', 'paid', 'partially_refunded'))
        or (p_status = 'refunded' and current_status in ('creating', 'pending', 'paid', 'partially_refunded'))
      );
    if not found then raise exception using errcode = '22023', message = 'Payment status cannot be updated'; end if;
    if p_status in ('paid', 'partially_refunded') then
      update public.seller_order_payment_stock_reservations set fulfilled_at = now()
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
      perform set_config('virapeca.internal_stock_adjustment', 'off', true);
    end if;
  end if;
end;
$$;

revoke all on function public.create_seller_order_payment(uuid, uuid, bigint),
  public.save_seller_order_payment_provider_order(uuid, text, text),
  public.fail_seller_order_payment(uuid, text, text),
  public.record_seller_order_payment_status(uuid, text, text, text),
  public.claim_mercado_pago_token_refresh(uuid),
  public.complete_mercado_pago_token_refresh(uuid, text, text, text, integer, text),
  public.release_mercado_pago_token_refresh(uuid) from public, anon, authenticated;
grant execute on function public.create_seller_order_payment(uuid, uuid, bigint),
  public.save_seller_order_payment_provider_order(uuid, text, text),
  public.fail_seller_order_payment(uuid, text, text),
  public.record_seller_order_payment_status(uuid, text, text, text),
  public.claim_mercado_pago_token_refresh(uuid),
  public.complete_mercado_pago_token_refresh(uuid, text, text, text, integer, text),
  public.release_mercado_pago_token_refresh(uuid) to service_role;
