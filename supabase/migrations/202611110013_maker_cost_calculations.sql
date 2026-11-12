create table public.maker_cost_calculations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 80),
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object' and octet_length(input_snapshot::text) <= 24000),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object' and octet_length(result_snapshot::text) <= 24000),
  calculation_version smallint not null default 1 check (calculation_version = 1),
  created_at timestamptz not null default now()
);

create index maker_cost_calculations_store_recent on public.maker_cost_calculations (store_id, created_at desc);

alter table public.maker_cost_calculations enable row level security;
revoke all on public.maker_cost_calculations from anon, authenticated;
grant select, insert, delete on public.maker_cost_calculations to authenticated;

create policy "Makers read their own saved calculations" on public.maker_cost_calculations
  for select to authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Makers save calculations for their own store" on public.maker_cost_calculations
  for insert to authenticated
  with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Makers delete calculations for their own store" on public.maker_cost_calculations
  for delete to authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );
