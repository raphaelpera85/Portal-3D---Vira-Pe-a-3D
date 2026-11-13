create function public.get_maker_payment_period_metrics()
returns table (
  window_days integer,
  paid_payment_count bigint,
  paid_total_cents bigint,
  marketplace_fee_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  maker_store_id uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Maker access required';
  end if;

  select s.id into maker_store_id from public.stores s where s.owner_user_id = (select auth.uid());
  if maker_store_id is null then
    raise exception using errcode = '42501', message = 'Store unavailable';
  end if;

  return query
    select windows.days, count(p.id)::bigint,
      coalesce(sum(p.total_cents), 0)::bigint,
      coalesce(sum(p.marketplace_fee_cents), 0)::bigint
    from (values (7), (30)) as windows(days)
    left join public.seller_order_payments p
      on p.store_id = maker_store_id
      and p.status = 'paid'
      and p.created_at >= statement_timestamp() - make_interval(days => windows.days)
      and p.created_at <= statement_timestamp()
    group by windows.days
    order by windows.days;
end;
$$;

revoke all on function public.get_maker_payment_period_metrics() from public, anon;
grant execute on function public.get_maker_payment_period_metrics() to authenticated;
