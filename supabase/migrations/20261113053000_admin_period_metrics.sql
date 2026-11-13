create or replace function public.get_admin_marketplace_period_metrics()
returns table (
  window_days integer,
  paid_payment_count bigint,
  gmv_cents bigint,
  gross_marketplace_fee_cents bigint,
  processed_refund_count bigint,
  processed_refund_cents bigint,
  confirmed_cancellation_count bigint,
  chargeback_case_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  return query
  select windows.days,
    (select count(*)::bigint from public.seller_order_payments p
      where p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')
        and p.created_at >= statement_timestamp() - make_interval(days => windows.days)),
    (select coalesce(sum(p.total_cents - p.shipping_cents), 0)::bigint from public.seller_order_payments p
      where p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')
        and p.created_at >= statement_timestamp() - make_interval(days => windows.days)),
    (select coalesce(sum(p.marketplace_fee_cents), 0)::bigint from public.seller_order_payments p
      where p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')
        and p.created_at >= statement_timestamp() - make_interval(days => windows.days)),
    (select count(*)::bigint from public.seller_order_refunds r
      where r.status = 'processed' and r.created_at >= statement_timestamp() - make_interval(days => windows.days)),
    (select coalesce(sum(r.amount_cents), 0)::bigint from public.seller_order_refunds r
      where r.status = 'processed' and r.created_at >= statement_timestamp() - make_interval(days => windows.days)),
    (select count(*)::bigint from public.seller_order_payment_cancellations c
      where c.status = 'processed' and c.created_at >= statement_timestamp() - make_interval(days => windows.days)),
    (select count(*)::bigint from public.seller_order_chargebacks c
      where c.created_at >= statement_timestamp() - make_interval(days => windows.days))
  from (values (7), (30)) as windows(days)
  order by windows.days;
end;
$$;

revoke all on function public.get_admin_marketplace_period_metrics() from public, anon, authenticated;
grant execute on function public.get_admin_marketplace_period_metrics() to service_role;
