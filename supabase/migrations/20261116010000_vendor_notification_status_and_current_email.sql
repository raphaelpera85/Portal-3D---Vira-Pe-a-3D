create function public.authorize_store_notification_email_delivery(delivery_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare current_email text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select c.email into current_email
  from public.store_notification_deliveries d
  join public.store_notification_contacts c on
    exists (select 1 from public.product_quote_requests q where q.id = d.request_id and q.store_id = c.store_id)
    or exists (select 1 from public.seller_purchase_orders o where o.id = d.order_id and o.store_id = c.store_id)
    or exists (select 1 from public.custom_print_request_targets t where t.id = d.custom_print_target_id and t.store_id = c.store_id)
    or exists (
      select 1 from public.designer_service_requests r
      join public.designer_profiles p on p.id = r.designer_profile_id
      join public.stores s on s.owner_user_id = p.user_id
      where r.id = d.designer_service_request_id and s.id = c.store_id
    )
  where d.id = delivery_id and d.channel = 'email' and d.status = 'sending'
  limit 1;

  if current_email is null then
    update public.store_notification_deliveries
      set status = 'cancelled', last_error = 'Email contact unavailable', updated_at = now()
      where id = delivery_id and channel = 'email' and status = 'sending';
    return null;
  end if;

  update public.store_notification_deliveries
    set destination = current_email, updated_at = now()
    where id = delivery_id and channel = 'email' and status = 'sending';
  return current_email;
end;
$$;
revoke all on function public.authorize_store_notification_email_delivery(uuid) from public, anon, authenticated;
grant execute on function public.authorize_store_notification_email_delivery(uuid) to service_role;

drop policy "Makers can read delivery status for their requests and orders" on public.store_notification_deliveries;
create policy "Makers can read delivery status for their requests and orders"
  on public.store_notification_deliveries for select to authenticated
  using (
    (
      (request_id is not null and exists (
        select 1 from public.product_quote_requests q join public.stores s on s.id = q.store_id
        where q.id = store_notification_deliveries.request_id and s.owner_user_id = (select auth.uid())
      )) or (order_id is not null and exists (
        select 1 from public.seller_purchase_orders o join public.stores s on s.id = o.store_id
        where o.id = store_notification_deliveries.order_id and s.owner_user_id = (select auth.uid())
      ))
    ) and exists (
      select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
    )
  );

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'store_notification_deliveries'
    ) then
    alter publication supabase_realtime add table public.store_notification_deliveries;
  end if;
end; $$;
