alter table public.maker_cost_calculations
  add column printer_id uuid references public.maker_printers (id) on delete set null;

create index maker_cost_calculations_printer_recent
  on public.maker_cost_calculations (printer_id, created_at desc)
  where printer_id is not null;

drop policy "Makers save calculations for their own store" on public.maker_cost_calculations;
create policy "Makers save calculations for their own store" on public.maker_cost_calculations
  for insert to authenticated
  with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    and (product_id is null or exists (select 1 from public.marketplace_products p
      where p.id = product_id and p.store_id = maker_cost_calculations.store_id))
    and (printer_id is null or exists (select 1 from public.maker_printers p
      where p.id = printer_id and p.store_id = maker_cost_calculations.store_id))
  );
