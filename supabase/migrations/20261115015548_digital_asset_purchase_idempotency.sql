create or replace function public.request_digital_asset_purchase(p_product_id uuid, p_license_type text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  product_row record;
  license_price numeric(12, 2);
  request_id uuid;
begin
  if actor_id is null or p_product_id is null or p_license_type is null or p_license_type not in ('personal', 'commercial')
    or not exists (select 1 from public.user_roles r where r.user_id = actor_id and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '22023', message = 'Invalid digital asset purchase';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text || ':' || p_product_id::text || ':' || p_license_type, 0));
  select p.id, p.store_id, p.name, p.price_brl, s.name as store_name,
    d.personal_price_brl, d.commercial_price_brl
    into product_row from public.marketplace_products p join public.stores s on s.id = p.store_id
    join public.digital_assets d on d.product_id = p.id and d.store_id = p.store_id
    where p.id = p_product_id and p.listing_type = 'digital' and p.fulfillment_mode = 'digital'
      and p.price_mode = 'fixed' and p.catalog_status = 'published' and s.status = 'published';
  if not found then raise exception using errcode = '22023', message = 'Digital asset is not available'; end if;
  license_price := case p_license_type when 'personal' then product_row.personal_price_brl else product_row.commercial_price_brl end;
  if license_price is null or license_price <= 0 or license_price > 1000000 then
    raise exception using errcode = '22023', message = 'Selected license is not available';
  end if;

  select q.id into request_id from public.product_quote_requests q
    where q.buyer_id = actor_id and q.product_id = p_product_id and q.request_type = 'purchase'
      and q.license_type = p_license_type and q.status = 'accepted'
      and not exists (select 1 from public.seller_order_payments p where p.purchase_request_id = q.id
        and p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back'))
    order by case when exists (select 1 from public.seller_order_payments p
      where p.purchase_request_id = q.id and p.status in ('creating', 'pending')) then 0 else 1 end,
      q.created_at desc
    limit 1;
  if found then
    update public.product_quote_requests q set unit_price_brl = license_price
      where q.id = request_id and not exists (select 1 from public.seller_order_payments p
        where p.purchase_request_id = q.id and p.status in ('creating', 'pending'));
    return request_id;
  end if;

  insert into public.product_quote_requests (buyer_id, store_id, product_id, store_name, product_name,
    request_type, unit_price_brl, quantity, customization, status, license_type)
  values (actor_id, product_row.store_id, product_row.id, product_row.store_name, product_row.name,
    'purchase', license_price, 1, '', 'accepted', p_license_type)
  returning id into request_id;
  return request_id;
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
    or not exists (
      select 1 from public.marketplace_products p where p.id = request_row.product_id and p.store_id = request_row.store_id
        and p.catalog_status = 'published' and p.price_mode = 'fixed'
        and (
          (request_row.license_type is null and p.listing_type = 'physical')
          or (request_row.license_type in ('personal', 'commercial') and request_row.quantity = 1 and request_row.variant_id is null
            and p.listing_type = 'digital' and p.fulfillment_mode = 'digital'
            and exists (select 1 from public.digital_assets d where d.product_id = p.id and d.store_id = p.store_id))
        )
    ) then
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
  if request_row.license_type is not null and not exists (select 1 from public.digital_assets d
      where d.product_id = request_row.product_id and d.store_id = request_row.store_id
        and (case request_row.license_type when 'personal' then d.personal_price_brl else d.commercial_price_brl end) = request_row.unit_price_brl) then
    raise exception using errcode = '22023', message = 'Digital asset price has changed';
  end if;
  if request_row.license_type is null then
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
  end if;
  calculated_total := round(request_row.unit_price_brl * 100)::bigint * request_row.quantity;
  if calculated_total < 1 or p_marketplace_fee_cents is null or p_marketplace_fee_cents < 0
    or p_marketplace_fee_cents >= calculated_total then
    raise exception using errcode = '22023', message = 'Invalid payment amount or marketplace fee';
  end if;
  insert into public.seller_order_payments (purchase_request_id, buyer_id, store_id, total_cents, marketplace_fee_cents)
    values (p_request_id, p_buyer_id, request_row.store_id, calculated_total, p_marketplace_fee_cents)
    returning id into next_payment_id;

  if request_row.license_type is null then
    perform set_config('virapeca.internal_stock_adjustment', 'on', true);
    perform public.reserve_seller_order_product_stock(next_payment_id, request_row.product_id, request_row.variant_id, request_row.quantity);
    perform set_config('virapeca.internal_stock_adjustment', 'off', true);
  end if;
  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;
