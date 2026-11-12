create table public.seller_order_chargebacks (
  case_id text primary key check (case_id ~ '^[0-9]{1,30}$'),
  payment_id uuid not null references public.seller_order_payments (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  case_status text not null check (case_status ~ '^[a-z_]{1,40}$'),
  reason text,
  reason_id text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  coverage_applied boolean,
  coverage_eligible boolean,
  documentation_status text not null check (documentation_status in ('pending', 'review_pending', 'valid', 'invalid', 'not_supplied', 'not_applicable')),
  documentation_deadline timestamptz,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index seller_order_chargebacks_store_recent on public.seller_order_chargebacks (store_id, provider_updated_at desc);
alter table public.seller_order_chargebacks enable row level security;
revoke all on public.seller_order_chargebacks from anon, authenticated;
grant select on public.seller_order_chargebacks to authenticated;
grant all on public.seller_order_chargebacks to service_role;
create policy "Makers can read chargebacks for their store" on public.seller_order_chargebacks for select to authenticated
  using (exists (select 1 from public.stores s join public.user_roles r on r.user_id = s.owner_user_id
    where s.id = store_id and s.owner_user_id = (select auth.uid()) and r.role = 'maker'::public.app_role));
