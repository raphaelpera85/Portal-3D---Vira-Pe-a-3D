alter table public.seller_order_payments
  add column custom_print_request_id uuid references public.custom_print_requests (id) on delete restrict;

alter table public.seller_order_payments drop constraint seller_order_payment_source_check;
alter table public.seller_order_payments add constraint seller_order_payment_source_check
  check (num_nonnulls(order_id, purchase_request_id, custom_print_request_id) = 1);
create unique index seller_custom_print_payment_one_active on public.seller_order_payments (custom_print_request_id)
  where custom_print_request_id is not null and status in ('creating', 'pending');

create function public.create_custom_print_payment(p_request_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  request_row public.custom_print_requests%rowtype;
  offer_row public.custom_print_offers%rowtype;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
  calculated_total bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  select q.* into request_row from public.custom_print_requests q
    where q.id = p_request_id and q.buyer_id = p_buyer_id and q.status = 'accepted' and q.winning_store_id is not null
    for update;
  if not found then raise exception using errcode = '22023', message = 'Accepted custom print request not found'; end if;
  select o.* into offer_row from public.custom_print_offers o
    where o.request_id = request_row.id and o.store_id = request_row.winning_store_id and o.status = 'accepted' for update;
  if not found or not exists (select 1 from public.store_payment_connections c where c.store_id = offer_row.store_id)
    or not exists (select 1 from public.stores s where s.id = offer_row.store_id and s.status = 'published') then
    raise exception using errcode = '22023', message = 'Accepted offer or seller payment account is unavailable';
  end if;
  select p.* into existing from public.seller_order_payments p
    where p.custom_print_request_id = p_request_id and p.status in ('creating', 'pending') for update;
  if found then
    return query select existing.id, existing.status, existing.total_cents, existing.marketplace_fee_cents,
      existing.provider_order_id, existing.checkout_url, existing.store_id;
    return;
  end if;
  if exists (select 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id
      and p.status in ('paid', 'partially_refunded', 'refunded')) then
    raise exception using errcode = '22023', message = 'Custom print request has already been charged';
  end if;

  calculated_total := round(offer_row.total_brl * 100)::bigint;
  if calculated_total < 1 or p_marketplace_fee_cents is null or p_marketplace_fee_cents < 0
    or p_marketplace_fee_cents >= calculated_total then
    raise exception using errcode = '22023', message = 'Invalid payment amount or marketplace fee';
  end if;
  insert into public.seller_order_payments (custom_print_request_id, buyer_id, store_id, total_cents, marketplace_fee_cents)
    values (p_request_id, p_buyer_id, offer_row.store_id, calculated_total, p_marketplace_fee_cents)
    returning id into next_payment_id;
  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;

create or replace function public.cancel_custom_print_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype;
begin
  select * into request_row from public.custom_print_requests q
    where q.id = p_request_id and q.buyer_id = (select auth.uid()) for update;
  if request_row.id is null or not (
      request_row.status in ('pending', 'offered')
      or (request_row.status = 'accepted' and request_row.production_started_at is null)
    ) or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '22023', message = 'Request cannot be cancelled';
  end if;
  perform 1 from public.seller_order_payments p where p.custom_print_request_id = p_request_id
    and p.status in ('creating', 'pending', 'paid', 'partially_refunded') for update;
  if found then raise exception using errcode = '22023', message = 'Request cannot be cancelled while payment is active'; end if;
  update public.custom_print_requests set status = 'cancelled', winning_store_id = null, updated_at = now() where id = request_row.id;
  update public.custom_print_request_targets set status = 'closed' where request_id = request_row.id and status in ('invited', 'offered', 'accepted');
  update public.custom_print_offers set status = 'closed', updated_at = now() where request_id = request_row.id and status in ('offered', 'accepted');
end;
$$;

create or replace function public.advance_custom_print_production(p_request_id uuid, p_next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype; payment_status text;
begin
  select * into request_row from public.custom_print_requests q where q.id = p_request_id for update;
  if request_row.id is null or request_row.winning_store_id is null
    or not exists (select 1 from public.stores s where s.id = request_row.winning_store_id and s.owner_user_id = (select auth.uid()))
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or not ((request_row.status = 'accepted' and p_next_status = 'in_production')
      or (request_row.status = 'in_production' and p_next_status = 'completed')) then
    raise exception using errcode = '42501', message = 'Production status cannot be changed';
  end if;
  if p_next_status = 'in_production' then
    select p.status into payment_status from public.seller_order_payments p
      where p.custom_print_request_id = request_row.id for update;
    if not found or payment_status <> 'paid' then
      raise exception using errcode = '42501', message = 'Payment must be confirmed before production';
    end if;
  end if;
  update public.custom_print_requests set status = p_next_status,
    production_started_at = case when p_next_status = 'in_production' then now() else production_started_at end,
    production_completed_at = case when p_next_status = 'completed' then now() else production_completed_at end,
    updated_at = now() where id = request_row.id;
end;
$$;

revoke all on function public.create_custom_print_payment(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.create_custom_print_payment(uuid, uuid, bigint) to service_role;
