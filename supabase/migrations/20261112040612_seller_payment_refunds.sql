create table public.seller_order_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.seller_order_payments (id) on delete restrict,
  requested_by uuid not null references auth.users (id) on delete restrict,
  idempotency_key uuid not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  is_full boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  provider_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, idempotency_key)
);

create unique index seller_order_refund_one_pending_per_payment on public.seller_order_refunds (payment_id)
  where status = 'pending';
create index seller_order_refunds_payment_recent on public.seller_order_refunds (payment_id, created_at desc);

alter table public.seller_order_refunds enable row level security;
revoke all on public.seller_order_refunds from anon, authenticated;
grant select on public.seller_order_refunds to authenticated;
create policy "Payment participants can read refund history" on public.seller_order_refunds for select to authenticated
  using (exists (select 1 from public.seller_order_payments p where p.id = payment_id));

create function public.reserve_seller_order_refund(p_payment_id uuid, p_maker_id uuid, p_amount_cents bigint, p_idempotency_key uuid)
returns table (refund_id uuid, refund_amount_cents bigint, refund_is_full boolean, refund_status text,
  refund_idempotency_key uuid, refund_available_cents bigint)
language plpgsql security definer set search_path = '' as $$
declare
  payment_row public.seller_order_payments%rowtype;
  refund_row public.seller_order_refunds%rowtype;
  reserved_cents bigint;
  available_cents bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_maker_id is null or p_amount_cents is null or p_amount_cents < 1 or p_idempotency_key is null then
    raise exception using errcode = '42501', message = 'Invalid refund request';
  end if;
  select p.* into payment_row from public.seller_order_payments p where p.id = p_payment_id for update;
  if not found or payment_row.status not in ('paid', 'partially_refunded') or payment_row.provider_order_id is null
    or not exists (select 1 from public.stores s join public.user_roles r on r.user_id = s.owner_user_id
      where s.id = payment_row.store_id and s.owner_user_id = p_maker_id and r.role = 'maker'::public.app_role) then
    raise exception using errcode = '22023', message = 'Payment is unavailable for refund';
  end if;

  select r.* into refund_row from public.seller_order_refunds r
    where r.payment_id = p_payment_id and r.idempotency_key = p_idempotency_key for update;
  if found then
    if refund_row.amount_cents <> p_amount_cents then raise exception using errcode = '22023', message = 'Refund key was already used with another amount'; end if;
    select coalesce(sum(r.amount_cents), 0) into reserved_cents from public.seller_order_refunds r
      where r.payment_id = p_payment_id and r.status in ('pending', 'processed');
    return query select refund_row.id, refund_row.amount_cents, refund_row.is_full, refund_row.status, refund_row.idempotency_key,
      greatest(payment_row.total_cents - reserved_cents + refund_row.amount_cents, 0);
    return;
  end if;

  select r.* into refund_row from public.seller_order_refunds r
    where r.payment_id = p_payment_id and r.status = 'pending' for update;
  if found then
    if refund_row.amount_cents <> p_amount_cents then raise exception using errcode = '22023', message = 'Another refund is awaiting provider confirmation'; end if;
    select coalesce(sum(r.amount_cents), 0) into reserved_cents from public.seller_order_refunds r
      where r.payment_id = p_payment_id and r.status in ('pending', 'processed');
    return query select refund_row.id, refund_row.amount_cents, refund_row.is_full, refund_row.status, refund_row.idempotency_key,
      greatest(payment_row.total_cents - reserved_cents + refund_row.amount_cents, 0);
    return;
  end if;

  select coalesce(sum(r.amount_cents), 0) into reserved_cents from public.seller_order_refunds r
    where r.payment_id = p_payment_id and r.status in ('pending', 'processed');
  available_cents := payment_row.total_cents - reserved_cents;
  if p_amount_cents > available_cents then raise exception using errcode = '22023', message = 'Refund amount exceeds the remaining payment'; end if;

  insert into public.seller_order_refunds (payment_id, requested_by, idempotency_key, amount_cents, is_full)
    values (p_payment_id, p_maker_id, p_idempotency_key, p_amount_cents,
      p_amount_cents = payment_row.total_cents and reserved_cents = 0)
    returning * into refund_row;
  return query select refund_row.id, refund_row.amount_cents, refund_row.is_full, refund_row.status, refund_row.idempotency_key, available_cents;
end;
$$;

create function public.complete_seller_order_refund(p_refund_id uuid, p_status text, p_provider_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_status not in ('pending', 'processed', 'failed')
    or p_provider_status is null or char_length(p_provider_status) > 120 then
    raise exception using errcode = '42501', message = 'Invalid refund status update';
  end if;
  update public.seller_order_refunds set status = p_status, provider_status = p_provider_status, updated_at = now()
    where id = p_refund_id and (status = 'pending' or status = p_status);
  if not found then raise exception using errcode = '22023', message = 'Refund status cannot be updated'; end if;
end;
$$;

revoke all on function public.reserve_seller_order_refund(uuid, uuid, bigint, uuid),
  public.complete_seller_order_refund(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_seller_order_refund(uuid, uuid, bigint, uuid),
  public.complete_seller_order_refund(uuid, text, text) to service_role;
