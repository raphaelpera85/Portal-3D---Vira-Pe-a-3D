create or replace function public.claim_store_notification_deliveries(batch_size integer default 20)
returns table (id uuid, channel text, destination text, payload jsonb, attempts smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  take_count integer := least(greatest(coalesce(batch_size, 20), 1), 50);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  update public.store_notification_deliveries
    set status = 'failed', last_error = 'Delivery timed out after the final attempt', updated_at = now()
    where status = 'sending' and attempts >= 5 and updated_at < now() - interval '10 minutes';

  return query
    with claimable as (
      select d.id from public.store_notification_deliveries d
      where d.attempts < 5 and (
        (d.status = 'pending' and d.next_attempt_at <= now())
        or (d.status = 'sending' and d.updated_at < now() - interval '10 minutes')
      )
      order by d.created_at
      for update skip locked
      limit take_count
    ), claimed as (
      update public.store_notification_deliveries d
      set status = 'sending', attempts = d.attempts + 1, updated_at = now()
      from claimable c where d.id = c.id
      returning d.id, d.channel, d.destination, d.payload, d.attempts
    )
    select c.id, c.channel, c.destination, c.payload, c.attempts from claimed c;
end;
$$;

revoke all on function public.claim_store_notification_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_store_notification_deliveries(integer) to service_role;
