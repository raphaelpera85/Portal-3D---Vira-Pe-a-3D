alter table public.store_notification_deliveries
  drop constraint store_notification_deliveries_status_check,
  add constraint store_notification_deliveries_status_check
    check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled'));

create function public.store_notification_whatsapp_consent_is_current(delivery_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.store_notification_deliveries d
    join public.store_notification_contacts c on c.whatsapp = d.destination and c.whatsapp_opt_in
    where d.id = delivery_id and d.channel = 'whatsapp'
      and (
        exists (select 1 from public.product_quote_requests q where q.id = d.request_id and q.store_id = c.store_id)
        or exists (select 1 from public.seller_purchase_orders o where o.id = d.order_id and o.store_id = c.store_id)
        or exists (select 1 from public.custom_print_request_targets t where t.id = d.custom_print_target_id and t.store_id = c.store_id)
        or exists (
          select 1 from public.designer_service_requests r
          join public.designer_profiles p on p.id = r.designer_profile_id
          join public.stores s on s.owner_user_id = p.user_id
          where r.id = d.designer_service_request_id and s.id = c.store_id
        )
      )
  );
$$;
revoke all on function public.store_notification_whatsapp_consent_is_current(uuid) from public, anon, authenticated;
grant execute on function public.store_notification_whatsapp_consent_is_current(uuid) to service_role;

create function public.authorize_store_notification_whatsapp_delivery(delivery_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if exists (
    select 1 from public.store_notification_deliveries d
    where d.id = delivery_id and d.channel = 'whatsapp' and d.status = 'sending'
      and public.store_notification_whatsapp_consent_is_current(d.id)
  ) then
    return true;
  end if;
  update public.store_notification_deliveries
    set status = 'cancelled', last_error = 'WhatsApp consent revoked or contact changed', updated_at = now()
    where id = delivery_id and channel = 'whatsapp' and status = 'sending';
  return false;
end;
$$;
revoke all on function public.authorize_store_notification_whatsapp_delivery(uuid) from public, anon, authenticated;
grant execute on function public.authorize_store_notification_whatsapp_delivery(uuid) to service_role;

create or replace function public.retry_store_notification_delivery(delivery_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_notification_deliveries d
    where d.id = delivery_id and d.status = 'failed'
      and (d.channel <> 'whatsapp' or public.store_notification_whatsapp_consent_is_current(d.id))
      and (
        (d.request_id is not null and exists (
          select 1 from public.product_quote_requests q join public.stores s on s.id = q.store_id
          where q.id = d.request_id and s.owner_user_id = (select auth.uid())
        )) or (d.order_id is not null and exists (
          select 1 from public.seller_purchase_orders o join public.stores s on s.id = o.store_id
          where o.id = d.order_id and s.owner_user_id = (select auth.uid())
        ))
      )
  ) or not exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Delivery cannot be retried';
  end if;
  update public.store_notification_deliveries
    set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
    where id = delivery_id and status = 'failed';
end;
$$;

create or replace function public.retry_custom_print_notification_delivery(p_delivery_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_notification_deliveries d
    join public.custom_print_request_targets t on t.id = d.custom_print_target_id
    join public.stores s on s.id = t.store_id
    where d.id = p_delivery_id and d.status = 'failed' and s.owner_user_id = (select auth.uid())
      and t.status in ('invited', 'offered', 'accepted')
      and (d.channel <> 'whatsapp' or public.store_notification_whatsapp_consent_is_current(d.id))
  ) or not exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Delivery cannot be retried';
  end if;
  update public.store_notification_deliveries
    set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
    where id = p_delivery_id and status = 'failed';
end;
$$;
