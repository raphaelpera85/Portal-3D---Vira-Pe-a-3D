create table public.maker_consignment_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid references public.marketplace_products (id) on delete set null,
  establishment text not null check (char_length(btrim(establishment)) between 2 and 120),
  product_name text not null check (char_length(btrim(product_name)) between 2 and 200),
  unit_cost_brl numeric(12, 2) not null check (unit_cost_brl between 0 and 1000000),
  sale_price_brl numeric(12, 2) not null check (sale_price_brl between 0.01 and 1000000),
  commission_percent numeric(5, 2) not null default 0 check (commission_percent between 0 and 100),
  created_at timestamptz not null default now(),
  check (product_id is null or product_name <> '')
);

create index maker_consignment_store_recent on public.maker_consignment_items (store_id, created_at desc);

create table public.maker_consignment_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.maker_consignment_items (id) on delete cascade,
  movement_type text not null check (movement_type in ('delivered', 'sold', 'returned', 'lost')),
  quantity integer not null check (quantity between 1 and 100000),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index maker_consignment_movements_item_recent on public.maker_consignment_movements (item_id, created_at desc);

alter table public.maker_consignment_items enable row level security;
alter table public.maker_consignment_movements enable row level security;
revoke all on public.maker_consignment_items, public.maker_consignment_movements from anon, authenticated;
grant select on public.maker_consignment_items, public.maker_consignment_movements to authenticated;

create policy "Makers read consignments for their own store" on public.maker_consignment_items
  for select to authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Makers read movements for their own consignments" on public.maker_consignment_movements
  for select to authenticated
  using (
    exists (
      select 1 from public.maker_consignment_items i join public.stores s on s.id = i.store_id
      where i.id = item_id and s.owner_user_id = (select auth.uid())
    )
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create function public.create_maker_consignment_item(
  p_establishment text,
  p_product_name text,
  p_quantity integer,
  p_unit_cost_brl numeric,
  p_sale_price_brl numeric,
  p_commission_percent numeric,
  p_product_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  maker_store uuid;
  new_item uuid;
begin
  if (select auth.uid()) is null
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or p_establishment is null or char_length(btrim(p_establishment)) not between 2 and 120
    or p_product_name is null or char_length(btrim(p_product_name)) not between 2 and 200
    or p_quantity is null or p_quantity not between 1 and 100000
    or p_unit_cost_brl is null or p_unit_cost_brl not between 0 and 1000000
    or p_sale_price_brl is null or p_sale_price_brl not between 0.01 and 1000000
    or p_commission_percent is null or p_commission_percent not between 0 and 100
  then raise exception using errcode = '22023', message = 'Invalid consignment item'; end if;

  select s.id into maker_store from public.stores s where s.owner_user_id = (select auth.uid());
  if maker_store is null then raise exception using errcode = '42501', message = 'Maker store is required'; end if;
  if p_product_id is not null and not exists (
    select 1 from public.marketplace_products p where p.id = p_product_id and p.store_id = maker_store and p.catalog_status = 'published'
  ) then raise exception using errcode = '22023', message = 'Product must be published by this store'; end if;

  insert into public.maker_consignment_items (store_id, product_id, establishment, product_name, unit_cost_brl, sale_price_brl, commission_percent)
    values (maker_store, p_product_id, btrim(p_establishment), btrim(p_product_name), p_unit_cost_brl, p_sale_price_brl, p_commission_percent)
    returning id into new_item;
  insert into public.maker_consignment_movements (item_id, movement_type, quantity) values (new_item, 'delivered', p_quantity);
  return new_item;
end;
$$;

create function public.record_maker_consignment_movement(p_item_id uuid, p_movement_type text, p_quantity integer, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivered_total integer;
  accounted_total integer;
  new_movement uuid;
begin
  if (select auth.uid()) is null
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or p_item_id is null or p_movement_type is null or p_movement_type not in ('delivered', 'sold', 'returned', 'lost')
    or p_quantity is null or p_quantity not between 1 and 100000
    or char_length(coalesce(p_notes, '')) > 500
  then raise exception using errcode = '22023', message = 'Invalid consignment movement'; end if;

  perform 1 from public.maker_consignment_items i join public.stores s on s.id = i.store_id
    where i.id = p_item_id and s.owner_user_id = (select auth.uid()) for update of i;
  if not found then raise exception using errcode = '42501', message = 'Consignment item is unavailable'; end if;

  select coalesce(sum(m.quantity) filter (where m.movement_type = 'delivered'), 0),
    coalesce(sum(m.quantity) filter (where m.movement_type in ('sold', 'returned', 'lost')), 0)
    into delivered_total, accounted_total
    from public.maker_consignment_movements m where m.item_id = p_item_id;

  if p_movement_type = 'delivered' then
    if delivered_total + p_quantity > 100000 then raise exception using errcode = '22023', message = 'Consignment quantity limit reached'; end if;
  elsif p_quantity > delivered_total - accounted_total then
    raise exception using errcode = '22023', message = 'Movement exceeds available consignment stock';
  end if;

  insert into public.maker_consignment_movements (item_id, movement_type, quantity, notes)
    values (p_item_id, p_movement_type, p_quantity, btrim(coalesce(p_notes, '')))
    returning id into new_movement;
  return new_movement;
end;
$$;

revoke all on function public.create_maker_consignment_item(text, text, integer, numeric, numeric, numeric, uuid) from public, anon;
revoke all on function public.record_maker_consignment_movement(uuid, text, integer, text) from public, anon;
grant execute on function public.create_maker_consignment_item(text, text, integer, numeric, numeric, numeric, uuid) to authenticated;
grant execute on function public.record_maker_consignment_movement(uuid, text, integer, text) to authenticated;
