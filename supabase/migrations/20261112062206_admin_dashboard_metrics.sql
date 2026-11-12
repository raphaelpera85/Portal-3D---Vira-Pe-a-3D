create or replace function public.get_admin_marketplace_metrics()
returns table (
  paid_payment_count bigint,
  gmv_cents bigint,
  gross_marketplace_fee_cents bigint,
  average_ticket_cents bigint,
  processed_refund_count bigint,
  processed_refund_cents bigint,
  confirmed_cancellation_count bigint,
  chargeback_case_count bigint,
  user_count bigint,
  maker_count bigint,
  published_store_count bigint,
  published_product_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;

  return query
  with paid_payments as (
    select p.total_cents - p.shipping_cents as merchandise_cents, p.marketplace_fee_cents
    from public.seller_order_payments p
    where p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')
  ), sales as (
    select count(*)::bigint as payment_count,
      coalesce(sum(merchandise_cents), 0)::bigint as gmv,
      coalesce(sum(marketplace_fee_cents), 0)::bigint as gross_fee
    from paid_payments
  )
  select sales.payment_count, sales.gmv, sales.gross_fee,
    case when sales.payment_count = 0 then 0
      else round(sales.gmv::numeric / sales.payment_count)::bigint end,
    (select count(*)::bigint from public.seller_order_refunds r where r.status = 'processed'),
    (select coalesce(sum(r.amount_cents), 0)::bigint from public.seller_order_refunds r where r.status = 'processed'),
    (select count(*)::bigint from public.seller_order_payment_cancellations c where c.status = 'processed'),
    (select count(*)::bigint from public.seller_order_chargebacks),
    (select count(distinct r.user_id)::bigint from public.user_roles r),
    (select count(distinct r.user_id)::bigint from public.user_roles r where r.role = 'maker'::public.app_role),
    (select count(*)::bigint from public.stores s where s.status = 'published'),
    (select count(*)::bigint from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.catalog_status = 'published' and s.status = 'published')
  from sales;
end;
$$;

revoke all on function public.get_admin_marketplace_metrics() from public, anon, authenticated;
grant execute on function public.get_admin_marketplace_metrics() to authenticated;

comment on function public.get_admin_marketplace_metrics() is
  'Admin-only lifetime aggregates. GMV excludes shipping and includes confirmed payments later refunded or charged back; fee is the original checkout fee, not settlement.';
