create or replace function public.respond_to_seller_purchase_order(p_order_id uuid, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or p_response is null or p_response not in ('accept', 'decline') then
    raise exception using errcode = '22023', message = 'Invalid order response';
  end if;
  update public.seller_purchase_orders o
    set status = case when p_response = 'accept' then 'accepted' else 'declined' end,
        maker_read_at = coalesce(maker_read_at, now()), updated_at = now()
    from public.stores s
    where o.id = p_order_id and s.id = o.store_id and s.owner_user_id = (select auth.uid()) and s.status = 'published'
      and o.status = 'pending'
      and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role);
  if not found then raise exception using errcode = '42501', message = 'Order is not available to this maker'; end if;
end; $$;
