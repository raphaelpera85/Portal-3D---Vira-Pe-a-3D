create table public.seller_order_payment_cancellations (
  payment_id uuid primary key references public.seller_order_payments (id) on delete restrict,
  requested_by uuid not null references auth.users (id) on delete restrict,
  idempotency_key uuid not null unique,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  provider_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_order_payment_cancellations enable row level security;
revoke all on public.seller_order_payment_cancellations from public, anon, authenticated;
grant select on public.seller_order_payment_cancellations to authenticated;
create policy "Payment participants can read cancellation status" on public.seller_order_payment_cancellations for select to authenticated
  using (exists (select 1 from public.seller_order_payments p where p.id = payment_id));

create function public.reserve_seller_order_payment_cancellation(p_payment_id uuid, p_buyer_id uuid, p_idempotency_key uuid)
returns table (cancellation_payment_id uuid, cancellation_status text, cancellation_idempotency_key uuid)
language plpgsql security definer set search_path = '' as $$
declare
  payment_row public.seller_order_payments%rowtype;
  cancellation_row public.seller_order_payment_cancellations%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_payment_id is null or p_buyer_id is null or p_idempotency_key is null then
    raise exception using errcode = '42501', message = 'Invalid payment cancellation request';
  end if;
  select p.* into payment_row from public.seller_order_payments p
    where p.id = p_payment_id and p.buyer_id = p_buyer_id for update;
  if not found then raise exception using errcode = '22023', message = 'Payment is unavailable for cancellation'; end if;

  select c.* into cancellation_row from public.seller_order_payment_cancellations c
    where c.payment_id = p_payment_id for update;
  if found then
    return query select cancellation_row.payment_id, cancellation_row.status, cancellation_row.idempotency_key;
    return;
  end if;
  if payment_row.status <> 'pending' or payment_row.provider_order_id is null then
    raise exception using errcode = '22023', message = 'Payment is not pending cancellation';
  end if;

  insert into public.seller_order_payment_cancellations (payment_id, requested_by, idempotency_key)
    values (p_payment_id, p_buyer_id, p_idempotency_key)
    returning * into cancellation_row;
  return query select cancellation_row.payment_id, cancellation_row.status, cancellation_row.idempotency_key;
end;
$$;

create function public.complete_seller_order_payment_cancellation(
  p_payment_id uuid, p_status text, p_provider_status text, p_payment_status text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  payment_row public.seller_order_payments%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_status not in ('processed', 'failed')
    or p_provider_status is null or char_length(p_provider_status) > 120
    or (p_payment_status is not null and p_payment_status not in ('paid', 'partially_refunded', 'refunded', 'charged_back', 'pending', 'failed', 'expired', 'cancelled')) then
    raise exception using errcode = '42501', message = 'Invalid payment cancellation update';
  end if;
  select p.* into payment_row from public.seller_order_payments p
    where p.id = p_payment_id for update;
  if not found then raise exception using errcode = '22023', message = 'Payment cancellation cannot be updated'; end if;

  if p_payment_status is not null then
    perform public.record_seller_order_payment_status(
      payment_row.id, payment_row.provider_order_id, left(p_provider_status, 80), p_payment_status
    );
  end if;
  update public.seller_order_payment_cancellations
    set status = p_status, provider_status = p_provider_status, updated_at = now()
    where payment_id = p_payment_id and (status = 'pending' or status = p_status);
  if not found then raise exception using errcode = '22023', message = 'Payment cancellation cannot be updated'; end if;
end;
$$;

revoke all on function public.reserve_seller_order_payment_cancellation(uuid, uuid, uuid),
  public.complete_seller_order_payment_cancellation(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_seller_order_payment_cancellation(uuid, uuid, uuid),
  public.complete_seller_order_payment_cancellation(uuid, text, text, text) to service_role;
