alter table public.seller_order_payments
  alter column order_id drop not null,
  add column purchase_request_id uuid references public.product_quote_requests (id) on delete restrict,
  add constraint seller_order_payment_source_check check ((order_id is null) <> (purchase_request_id is null));

drop index public.seller_order_payment_one_active;
create unique index seller_order_payment_one_active on public.seller_order_payments (order_id)
  where order_id is not null and status in ('creating', 'pending');
create unique index seller_purchase_request_payment_one_active on public.seller_order_payments (purchase_request_id)
  where purchase_request_id is not null and status in ('creating', 'pending');

create function public.create_product_purchase_payment(p_request_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  request_row public.product_quote_requests%rowtype;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
  calculated_total bigint;
  available_stock integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  select q.* into request_row from public.product_quote_requests q
    where q.id = p_request_id and q.buyer_id = p_buyer_id and q.request_type = 'purchase' and q.status = 'accepted'
    for update;
  if not found then raise exception using errcode = '22023', message = 'Accepted product purchase not found'; end if;
  if not exists (select 1 from public.store_payment_connections c where c.store_id = request_row.store_id)
    or not exists (select 1 from public.stores s where s.id = request_row.store_id and s.status = 'published')
    or not exists (select 1 from public.marketplace_products p where p.id = request_row.product_id
      and p.store_id = request_row.store_id and p.catalog_status = 'published' and p.price_mode = 'fixed') then
    raise exception using errcode = '22023', message = 'Seller payment account or product is unavailable';
  end if;
  select p.* into existing from public.seller_order_payments p
    where p.purchase_request_id = p_request_id and p.status in ('creating', 'pending') for update;
  if found then
    return query select existing.id, existing.status, existing.total_cents, existing.marketplace_fee_cents,
      existing.provider_order_id, existing.checkout_url, existing.store_id;
    return;
  end if;
  if exists (select 1 from public.seller_order_payments p where p.purchase_request_id = p_request_id
      and p.status in ('paid', 'partially_refunded', 'refunded')) then
    raise exception using errcode = '22023', message = 'Product purchase has already been charged';
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
  select p.stock_quantity into available_stock from public.marketplace_products p where p.id = request_row.product_id for update;
  if available_stock is not null then
    if available_stock < request_row.quantity then raise exception using errcode = '22023', message = 'Insufficient stock for payment'; end if;
    update public.marketplace_products set stock_quantity = stock_quantity - request_row.quantity, updated_at = now()
      where id = request_row.product_id;
    insert into public.seller_order_payment_stock_reservations (payment_id, product_id, quantity)
      values (next_payment_id, request_row.product_id, request_row.quantity);
  end if;
  perform set_config('virapeca.internal_stock_adjustment', 'off', true);

  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;

revoke all on function public.create_product_purchase_payment(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.create_product_purchase_payment(uuid, uuid, bigint) to service_role;
