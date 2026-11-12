create table public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete restrict,
  order_id uuid not null references public.seller_purchase_orders (id) on delete restrict,
  order_item_id uuid references public.seller_purchase_order_items (id) on delete restrict,
  review_type text not null check (review_type in ('product', 'store')),
  product_id uuid references public.marketplace_products (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 1200),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((review_type = 'product' and order_item_id is not null and product_id is not null)
      or (review_type = 'store' and order_item_id is null and product_id is null)),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null)
      or (status in ('published', 'rejected') and reviewed_by is not null and reviewed_at is not null))
);

create unique index marketplace_reviews_one_product_per_item on public.marketplace_reviews (order_item_id)
  where review_type = 'product';
create unique index marketplace_reviews_one_store_per_order on public.marketplace_reviews (order_id)
  where review_type = 'store';
create index marketplace_reviews_public_product on public.marketplace_reviews (product_id, created_at desc)
  where status = 'published' and review_type = 'product';
create index marketplace_reviews_public_store on public.marketplace_reviews (store_id, created_at desc)
  where status = 'published' and review_type = 'store';
create index marketplace_reviews_pending on public.marketplace_reviews (created_at)
  where status = 'pending';

alter table public.marketplace_reviews enable row level security;
revoke all on public.marketplace_reviews from anon, authenticated;
grant select (id, review_type, product_id, store_id, rating, body, created_at)
  on public.marketplace_reviews to anon;
grant select (id, order_id, order_item_id, review_type, product_id, store_id, rating, body, status, created_at)
  on public.marketplace_reviews to authenticated;

create policy "Anyone can read published reviews for published listings"
  on public.marketplace_reviews for select to anon
  using (status = 'published'
    and exists (select 1 from public.stores s where s.id = store_id and s.status = 'published')
    and (product_id is null or exists (select 1 from public.marketplace_products p
      where p.id = product_id and p.catalog_status = 'published')));
create policy "Buyers and admins can read visible reviews"
  on public.marketplace_reviews for select to authenticated
  using ((buyer_id = (select auth.uid())) or (status = 'published'
    and exists (select 1 from public.stores s where s.id = store_id and s.status = 'published')
    and (product_id is null or exists (select 1 from public.marketplace_products p
      where p.id = product_id and p.catalog_status = 'published'))) or (select public.is_catalog_admin()));

create function public.submit_marketplace_review(p_order_id uuid, p_order_item_id uuid,
  p_rating smallint, p_body text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare order_row public.seller_purchase_orders%rowtype; item_row public.seller_purchase_order_items%rowtype; review_id uuid;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or p_order_id is null or p_rating is null or p_rating not between 1 and 5
    or char_length(coalesce(p_body, '')) > 1200 then
    raise exception using errcode = '22023', message = 'Invalid marketplace review';
  end if;

  select o.* into order_row from public.seller_purchase_orders o
    where o.id = p_order_id and o.buyer_id = (select auth.uid()) for update;
  if not found or order_row.shipment_status <> 'completed'
    or not exists (select 1 from public.seller_order_payments p
      where p.order_id = p_order_id and p.status = 'paid') then
    raise exception using errcode = '42501', message = 'A completed paid order is required to review';
  end if;

  if p_order_item_id is null then
    insert into public.marketplace_reviews (buyer_id, order_id, review_type, store_id, rating, body)
      values ((select auth.uid()), p_order_id, 'store', order_row.store_id, p_rating, nullif(btrim(p_body), ''))
      returning id into review_id;
  else
    select i.* into item_row from public.seller_purchase_order_items i
      where i.id = p_order_item_id and i.order_id = p_order_id;
    if not found or not exists (select 1 from public.marketplace_products p
        where p.id = item_row.product_id and p.store_id = order_row.store_id) then
      raise exception using errcode = '42501', message = 'Product does not belong to this order';
    end if;
    insert into public.marketplace_reviews (buyer_id, order_id, order_item_id, review_type, product_id, store_id, rating, body)
      values ((select auth.uid()), p_order_id, item_row.id, 'product', item_row.product_id, order_row.store_id,
        p_rating, nullif(btrim(p_body), '')) returning id into review_id;
  end if;
  return review_id;
end;
$$;
revoke all on function public.submit_marketplace_review(uuid, uuid, smallint, text) from public, anon;
grant execute on function public.submit_marketplace_review(uuid, uuid, smallint, text) to authenticated;

create function public.review_marketplace_review(p_review_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_catalog_admin() or p_review_id is null or p_decision is null
    or p_decision not in ('published', 'rejected') then
    raise exception using errcode = '42501', message = 'Review decision is not authorized';
  end if;
  update public.marketplace_reviews set status = p_decision,
    reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_review_id and status = 'pending';
  if not found then raise exception using errcode = '22023', message = 'Review is no longer pending'; end if;
end;
$$;
revoke all on function public.review_marketplace_review(uuid, text) from public, anon;
grant execute on function public.review_marketplace_review(uuid, text) to authenticated;

comment on table public.marketplace_reviews is 'Reviews submitted only by buyers with a completed and paid marketplace order; admin approval controls public visibility.';
