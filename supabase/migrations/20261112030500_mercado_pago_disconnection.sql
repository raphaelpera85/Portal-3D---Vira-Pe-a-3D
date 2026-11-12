create function public.lock_store_payment_connection(p_store_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_store_id is null then
    raise exception using errcode = '42501', message = 'Invalid payment connection request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('virapeca-payment-connection:' || p_store_id::text, 0)
  );
end;
$$;

create function public.guard_payment_connection_before_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_store_payment_connection(new.store_id);
  if not exists (select 1 from public.store_payment_connections c where c.store_id = new.store_id) then
    raise exception using errcode = '22023', message = 'Seller payment account is unavailable';
  end if;
  return new;
end;
$$;

create trigger seller_order_payments_require_connected_store
  before insert on public.seller_order_payments
  for each row execute function public.guard_payment_connection_before_payment();

create function public.guard_payment_connection_before_refund()
returns trigger language plpgsql security definer set search_path = '' as $$
declare payment_store_id uuid;
begin
  select p.store_id into payment_store_id from public.seller_order_payments p where p.id = new.payment_id;
  if payment_store_id is null then
    raise exception using errcode = '22023', message = 'Payment is unavailable for refund';
  end if;
  perform public.lock_store_payment_connection(payment_store_id);
  if not exists (select 1 from public.store_payment_connections c where c.store_id = payment_store_id) then
    raise exception using errcode = '22023', message = 'Seller payment account is unavailable';
  end if;
  return new;
end;
$$;

create trigger seller_order_refunds_require_connected_store
  before insert on public.seller_order_refunds
  for each row execute function public.guard_payment_connection_before_refund();

create function public.disconnect_mercado_pago_store(p_store_id uuid, p_maker_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_store_id is null or p_maker_id is null then
    raise exception using errcode = '42501', message = 'Invalid payment disconnection request';
  end if;
  if not exists (select 1 from public.stores s where s.id = p_store_id and s.owner_user_id = p_maker_id)
    or not exists (select 1 from public.user_roles r where r.user_id = p_maker_id and r.role = 'maker'::public.app_role) then
    raise exception using errcode = '42501', message = 'Payment connection owner mismatch';
  end if;

  perform public.lock_store_payment_connection(p_store_id);
  if not exists (select 1 from public.store_payment_connections c where c.store_id = p_store_id) then
    return 'not_connected';
  end if;
  if exists (select 1 from public.seller_order_payments p where p.store_id = p_store_id and p.status in ('creating', 'pending')) then
    return 'pending_payments';
  end if;
  if exists (select 1 from public.seller_order_refunds r join public.seller_order_payments p on p.id = r.payment_id
    where p.store_id = p_store_id and r.status = 'pending') then
    return 'pending_refunds';
  end if;

  delete from public.store_payment_connections where store_id = p_store_id;
  return 'disconnected';
end;
$$;

revoke all on function public.lock_store_payment_connection(uuid),
  public.guard_payment_connection_before_payment(), public.guard_payment_connection_before_refund(),
  public.disconnect_mercado_pago_store(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lock_store_payment_connection(uuid),
  public.disconnect_mercado_pago_store(uuid, uuid) to service_role;
