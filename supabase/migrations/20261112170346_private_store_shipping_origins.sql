create table public.store_shipping_origins (
  store_id uuid primary key references public.stores (id) on delete cascade,
  postal_code text not null check (postal_code ~ '^\d{8}$'),
  updated_at timestamptz not null default now()
);

alter table public.store_shipping_origins enable row level security;
revoke all on public.store_shipping_origins from anon, authenticated;
grant select, insert, update on public.store_shipping_origins to authenticated;

create policy "Store owners can manage their private shipping origin"
  on public.store_shipping_origins for all to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_shipping_origins.store_id and s.owner_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.stores s
    where s.id = store_shipping_origins.store_id and s.owner_user_id = (select auth.uid())
  ));
