alter table public.seller_order_payments drop constraint seller_order_payments_status_check;
alter table public.seller_order_payments add constraint seller_order_payments_status_check
  check (status in ('creating', 'pending', 'paid', 'partially_refunded', 'refunded', 'charged_back', 'failed', 'expired', 'cancelled'));

create function public.prevent_chargeback_payment_retry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.seller_order_payments p where p.status = 'charged_back' and (
      (new.order_id is not null and p.order_id = new.order_id)
      or (new.purchase_request_id is not null and p.purchase_request_id = new.purchase_request_id)
      or (new.custom_print_request_id is not null and p.custom_print_request_id = new.custom_print_request_id)
    )) then
    raise exception using errcode = '22023', message = 'A contested payment cannot be charged again';
  end if;
  return new;
end;
$$;

create trigger prevent_chargeback_payment_retry_before_insert
  before insert on public.seller_order_payments
  for each row execute function public.prevent_chargeback_payment_retry();

revoke all on function public.prevent_chargeback_payment_retry() from public, anon, authenticated;

create or replace function public.record_seller_order_payment_status(p_payment_id uuid, p_provider_order_id text, p_provider_status text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_status text;
  reservation record;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_status not in ('paid', 'partially_refunded', 'refunded', 'charged_back', 'pending', 'failed', 'expired', 'cancelled')
    or p_provider_status is null or char_length(p_provider_status) > 80 then
    raise exception using errcode = '42501', message = 'Invalid payment status update';
  end if;
  select p.status into current_status from public.seller_order_payments p where p.id = p_payment_id
    and p.provider_order_id = p_provider_order_id for update;
  if not found then raise exception using errcode = '22023', message = 'Payment status cannot be updated'; end if;
  if current_status = p_status then
    if p_status = 'charged_back' then
      update public.seller_order_payments set provider_status = p_provider_status, updated_at = now()
        where id = p_payment_id and provider_order_id = p_provider_order_id and provider_status is distinct from p_provider_status;
    end if;
    return;
  end if;
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
        or (p_status = 'charged_back' and current_status in ('creating', 'pending', 'paid', 'partially_refunded'))
      );
    if not found then raise exception using errcode = '22023', message = 'Payment status cannot be updated'; end if;
    if p_status in ('paid', 'partially_refunded', 'charged_back') then
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
