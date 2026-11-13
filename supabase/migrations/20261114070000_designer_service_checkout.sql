alter table public.designer_service_requests
  drop constraint designer_service_requests_status_check,
  drop constraint designer_service_requests_check,
  add constraint designer_service_requests_status_check check (status in ('pending', 'quoted', 'accepted', 'paid')),
  add constraint designer_service_requests_quote_state_check check (
    (status = 'pending' and quote_amount_cents is null and quote_lead_days is null and quote_notes is null)
    or (status in ('quoted', 'accepted', 'paid') and quote_amount_cents is not null and quote_lead_days is not null and quote_notes is not null)
  );

alter table public.seller_order_payments
  add column designer_service_request_id uuid references public.designer_service_requests (id) on delete restrict,
  drop constraint seller_order_payment_source_check,
  add constraint seller_order_payment_source_check
    check (num_nonnulls(order_id, purchase_request_id, custom_print_request_id, designer_service_request_id) = 1);

create unique index seller_designer_service_payment_one_active
  on public.seller_order_payments (designer_service_request_id)
  where designer_service_request_id is not null and status in ('creating', 'pending');

create or replace function public.prevent_chargeback_payment_retry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.seller_order_payments p where p.status = 'charged_back' and (
      (new.order_id is not null and p.order_id = new.order_id)
      or (new.purchase_request_id is not null and p.purchase_request_id = new.purchase_request_id)
      or (new.custom_print_request_id is not null and p.custom_print_request_id = new.custom_print_request_id)
      or (new.designer_service_request_id is not null and p.designer_service_request_id = new.designer_service_request_id)
    )) then
    raise exception using errcode = '22023', message = 'A contested payment cannot be charged again';
  end if;
  return new;
end;
$$;

create function public.create_designer_service_payment(p_request_id uuid, p_buyer_id uuid, p_marketplace_fee_cents bigint)
returns table (payment_id uuid, payment_status text, payment_total_cents bigint, payment_fee_cents bigint,
  payment_provider_order_id text, payment_checkout_url text, payment_store_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  request_row public.designer_service_requests%rowtype;
  store_id uuid;
  existing public.seller_order_payments%rowtype;
  next_payment_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_request_id is null or p_buyer_id is null then
    raise exception using errcode = '42501', message = 'Invalid designer service payment request';
  end if;

  select q.* into request_row from public.designer_service_requests q
    where q.id = p_request_id and q.buyer_id = p_buyer_id and q.status in ('quoted', 'accepted')
    for update;
  if not found then raise exception using errcode = '22023', message = 'Quoted designer service is unavailable'; end if;

  select s.id into store_id from public.designer_profiles d
    join public.stores s on s.owner_user_id = d.user_id
    where d.id = request_row.designer_profile_id and d.status = 'published' and s.status = 'published';
  if store_id is null or not exists (select 1 from public.store_payment_connections c where c.store_id = store_id) then
    raise exception using errcode = '22023', message = 'Designer payment account is unavailable';
  end if;

  select p.* into existing from public.seller_order_payments p
    where p.designer_service_request_id = p_request_id and p.status in ('creating', 'pending') for update;
  if found then
    return query select existing.id, existing.status, existing.total_cents, existing.marketplace_fee_cents,
      existing.provider_order_id, existing.checkout_url, existing.store_id;
    return;
  end if;

  if exists (select 1 from public.seller_order_payments p where p.designer_service_request_id = p_request_id
      and p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back'))
    or p_marketplace_fee_cents is null or p_marketplace_fee_cents < 0
    or p_marketplace_fee_cents >= request_row.quote_amount_cents then
    raise exception using errcode = '22023', message = 'Designer service has already been paid or the fee is invalid';
  end if;

  insert into public.seller_order_payments (designer_service_request_id, buyer_id, store_id, total_cents, marketplace_fee_cents)
    values (p_request_id, p_buyer_id, store_id, request_row.quote_amount_cents, p_marketplace_fee_cents)
    returning id into next_payment_id;
  update public.designer_service_requests set status = 'accepted', updated_at = now() where id = p_request_id;

  return query select p.id, p.status, p.total_cents, p.marketplace_fee_cents,
    p.provider_order_id, p.checkout_url, p.store_id from public.seller_order_payments p where p.id = next_payment_id;
end;
$$;

create function public.sync_designer_service_payment_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.designer_service_request_id is not null and new.status = 'paid' and old.status is distinct from new.status then
    update public.designer_service_requests set status = 'paid', updated_at = now()
      where id = new.designer_service_request_id and status = 'accepted';
  end if;
  return new;
end;
$$;

create trigger sync_designer_service_payment_status_after_change
  after update of status on public.seller_order_payments
  for each row execute function public.sync_designer_service_payment_status();

revoke all on function public.create_designer_service_payment(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.create_designer_service_payment(uuid, uuid, bigint) to service_role;
revoke all on function public.prevent_chargeback_payment_retry(), public.sync_designer_service_payment_status() from public, anon, authenticated;
