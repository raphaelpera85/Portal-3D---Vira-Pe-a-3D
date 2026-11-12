drop policy "Custom print delivery visible only to buyer and winning store" on public.custom_print_deliveries;
create policy "Custom print delivery visible only to buyer and winning store"
  on public.custom_print_deliveries for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or exists (
      select 1 from public.custom_print_requests q
      join public.stores s on s.id = q.winning_store_id
      where q.id = request_id and s.owner_user_id = (select auth.uid())
        and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    )
    or exists (
      select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role
    )
  );
