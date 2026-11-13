create function public.get_admin_support_response_metrics()
returns table (
  window_days integer,
  ticket_count bigint,
  first_response_count bigint,
  average_first_response_seconds numeric
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
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;

  return query
    select windows.days, count(t.id)::bigint,
      count(first_response.created_at)::bigint,
      round(avg(extract(epoch from (first_response.created_at - t.created_at))), 0)
    from (values (7), (30)) as windows(days)
    left join public.support_tickets t
      on t.created_at >= statement_timestamp() - make_interval(days => windows.days)
      and t.created_at <= statement_timestamp()
    left join lateral (
      select m.created_at from public.support_messages m
      where m.ticket_id = t.id and m.sender_role = 'admin'::public.app_role
        and m.created_at >= t.created_at
      order by m.created_at asc
      limit 1
    ) first_response on true
    group by windows.days
    order by windows.days;
end;
$$;

revoke all on function public.get_admin_support_response_metrics() from public, anon;
grant execute on function public.get_admin_support_response_metrics() to authenticated;
