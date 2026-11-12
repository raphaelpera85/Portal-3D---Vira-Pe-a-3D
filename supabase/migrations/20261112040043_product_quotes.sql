alter table public.marketplace_products
  add constraint marketplace_products_id_store_unique unique (id, store_id);

create table public.product_quote_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete restrict,
  store_id uuid not null,
  product_id uuid not null,
  store_name text not null,
  product_name text not null,
  quantity smallint not null default 1 check (quantity between 1 and 100),
  customization text not null default '' check (char_length(customization) <= 2000),
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'offered', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, store_id) references public.marketplace_products (id, store_id) on delete restrict
);

create table public.product_quote_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.product_quote_requests (id) on delete cascade,
  maker_id uuid not null references auth.users (id) on delete restrict,
  total_brl numeric(12, 2) not null check (total_brl > 0),
  lead_days smallint not null check (lead_days between 1 and 365),
  terms text not null default '' check (char_length(terms) <= 2000),
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_quote_buyer_recent on public.product_quote_requests (buyer_id, created_at desc);
create index product_quote_store_recent on public.product_quote_requests (store_id, created_at desc);
create index product_quote_open_queue on public.product_quote_requests (store_id, created_at) where status = 'pending';

alter table public.product_quote_requests enable row level security;
alter table public.product_quote_offers enable row level security;
revoke all on public.product_quote_requests, public.product_quote_offers from anon, authenticated;
grant select, insert on public.product_quote_requests to authenticated;
grant select on public.product_quote_offers to authenticated;

create policy "Buyers can read their product quote requests"
  on public.product_quote_requests for select to authenticated
  using ((select auth.uid()) = buyer_id);
create policy "Makers can read quote requests for their store"
  on public.product_quote_requests for select to authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );
create policy "Buyers can request quotes for published quote products"
  on public.product_quote_requests for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.marketplace_products p
      join public.stores s on s.id = p.store_id
      where p.id = product_quote_requests.product_id and p.store_id = product_quote_requests.store_id
        and p.catalog_status = 'published' and p.price_mode = 'quote' and s.status = 'published'
        and product_quote_requests.product_name = p.name and product_quote_requests.store_name = s.name
    )
  );
create policy "Marketplace admins can read quote requests"
  on public.product_quote_requests for select to authenticated
  using ((select public.is_catalog_admin()));

create policy "Buyers can read offers for their requests"
  on public.product_quote_offers for select to authenticated
  using (exists (select 1 from public.product_quote_requests q where q.id = request_id and q.buyer_id = (select auth.uid())));
create policy "Makers can read offers for their store requests"
  on public.product_quote_offers for select to authenticated
  using (
    exists (
      select 1 from public.product_quote_requests q
      join public.stores s on s.id = q.store_id
      where q.id = request_id and s.owner_user_id = (select auth.uid())
    )
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );
create policy "Marketplace admins can read quote offers"
  on public.product_quote_offers for select to authenticated
  using ((select public.is_catalog_admin()));

create function public.submit_product_quote_offer(p_request_id uuid, p_total_brl numeric, p_lead_days smallint, p_terms text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_store uuid;
  request_status text;
  inserted_offer uuid;
begin
  if (select auth.uid()) is null or p_total_brl <= 0 or p_total_brl > 1000000000 or p_lead_days < 1 or p_lead_days > 365 or char_length(coalesce(p_terms, '')) > 2000 then
    raise exception using errcode = '22023', message = 'Invalid quote offer';
  end if;

  select q.store_id, q.status into request_store, request_status
    from public.product_quote_requests q
    join public.stores s on s.id = q.store_id
    where q.id = p_request_id and s.owner_user_id = (select auth.uid()) and s.status = 'published'
      and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    for update of q;
  if not found or request_status <> 'pending' then
    raise exception using errcode = '42501', message = 'Quote request is not available to this maker';
  end if;

  insert into public.product_quote_offers (request_id, maker_id, total_brl, lead_days, terms)
    values (p_request_id, (select auth.uid()), p_total_brl, p_lead_days, coalesce(p_terms, ''))
    returning id into inserted_offer;
  update public.product_quote_requests set status = 'offered', updated_at = now() where id = p_request_id;
  return inserted_offer;
end;
$$;

create function public.respond_to_product_quote_offer(p_offer_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.product_quote_requests%rowtype;
  offer_status text;
begin
  if (select auth.uid()) is null or p_response is null or p_response not in ('accept', 'decline') then
    raise exception using errcode = '22023', message = 'Invalid quote response';
  end if;

  select q.* into request_row
    from public.product_quote_requests q
    join public.product_quote_offers o on o.request_id = q.id
    where o.id = p_offer_id and q.buyer_id = (select auth.uid())
    for update of q;
  if not found then
    raise exception using errcode = '42501', message = 'Quote offer does not belong to this buyer';
  end if;
  select status into offer_status from public.product_quote_offers where id = p_offer_id for update;
  if request_row.status <> 'offered' or offer_status <> 'offered' then
    raise exception using errcode = '55000', message = 'Quote offer is no longer available';
  end if;

  update public.product_quote_offers
    set status = case when p_response = 'accept' then 'accepted' else 'declined' end, updated_at = now()
    where id = p_offer_id;
  update public.product_quote_requests
    set status = case when p_response = 'accept' then 'accepted' else 'declined' end, updated_at = now()
    where id = request_row.id;
end;
$$;

create function public.cancel_product_quote_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  select status into current_status from public.product_quote_requests
    where id = p_request_id and buyer_id = (select auth.uid()) for update;
  if not found or current_status not in ('pending', 'offered') then
    raise exception using errcode = '42501', message = 'Quote request cannot be cancelled';
  end if;
  update public.product_quote_offers set status = 'declined', updated_at = now()
    where product_quote_offers.request_id = p_request_id and status = 'offered';
  update public.product_quote_requests set status = 'cancelled', updated_at = now() where id = p_request_id;
end;
$$;

revoke all on function public.submit_product_quote_offer(uuid, numeric, smallint, text) from public;
revoke all on function public.respond_to_product_quote_offer(uuid, text) from public;
revoke all on function public.cancel_product_quote_request(uuid) from public;
grant execute on function public.submit_product_quote_offer(uuid, numeric, smallint, text) to authenticated;
grant execute on function public.respond_to_product_quote_offer(uuid, text) to authenticated;
grant execute on function public.cancel_product_quote_request(uuid) to authenticated;
