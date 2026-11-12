alter table public.marketplace_reviews
  alter column order_id drop not null,
  add column purchase_request_id uuid references public.product_quote_requests (id) on delete restrict,
  add column custom_print_request_id uuid references public.custom_print_requests (id) on delete restrict;

alter table public.marketplace_reviews drop constraint if exists marketplace_reviews_check;
alter table public.marketplace_reviews add constraint marketplace_reviews_source_shape check (
  num_nonnulls(order_id, purchase_request_id, custom_print_request_id) = 1
  and (
    (order_id is not null and (
      (review_type = 'product' and order_item_id is not null and product_id is not null)
      or (review_type = 'store' and order_item_id is null and product_id is null)))
    or (purchase_request_id is not null and order_item_id is null and (
      (review_type = 'product' and product_id is not null)
      or (review_type = 'store' and product_id is null)))
    or (custom_print_request_id is not null and review_type = 'store'
      and order_item_id is null and product_id is null)
  )
);

create unique index marketplace_reviews_one_product_per_purchase on public.marketplace_reviews (purchase_request_id)
  where purchase_request_id is not null and review_type = 'product';
create unique index marketplace_reviews_one_store_per_purchase on public.marketplace_reviews (purchase_request_id)
  where purchase_request_id is not null and review_type = 'store';
create unique index marketplace_reviews_one_store_per_custom_print on public.marketplace_reviews (custom_print_request_id)
  where custom_print_request_id is not null;
create index marketplace_reviews_purchase_lookup on public.marketplace_reviews (purchase_request_id)
  where purchase_request_id is not null;
create index marketplace_reviews_custom_print_lookup on public.marketplace_reviews (custom_print_request_id)
  where custom_print_request_id is not null;

grant select (purchase_request_id, custom_print_request_id) on public.marketplace_reviews to authenticated;

create function public.submit_product_purchase_review(p_request_id uuid, p_review_type text,
  p_rating smallint, p_body text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_row public.product_quote_requests%rowtype; review_id uuid;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or p_request_id is null or p_review_type is null or p_review_type not in ('product', 'store')
    or p_rating is null or p_rating not between 1 and 5
    or char_length(coalesce(p_body, '')) > 1200 then
    raise exception using errcode = '22023', message = 'Invalid marketplace review';
  end if;
  select q.* into request_row from public.product_quote_requests q
    where q.id = p_request_id and q.buyer_id = (select auth.uid())
      and q.request_type = 'purchase' and q.status = 'accepted' for update;
  if not found or not exists (select 1 from public.seller_order_payments p
      where p.purchase_request_id = p_request_id and p.buyer_id = (select auth.uid()) and p.status = 'paid') then
    raise exception using errcode = '42501', message = 'A paid product purchase is required to review';
  end if;
  insert into public.marketplace_reviews (buyer_id, purchase_request_id, review_type,
      product_id, store_id, rating, body)
    values ((select auth.uid()), p_request_id, p_review_type,
      case when p_review_type = 'product' then request_row.product_id else null end,
      request_row.store_id, p_rating, nullif(btrim(p_body), '')) returning id into review_id;
  return review_id;
end;
$$;
revoke all on function public.submit_product_purchase_review(uuid, text, smallint, text) from public, anon;
grant execute on function public.submit_product_purchase_review(uuid, text, smallint, text) to authenticated;

create function public.submit_custom_print_review(p_request_id uuid, p_rating smallint, p_body text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype; review_id uuid;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or p_request_id is null or p_rating is null or p_rating not between 1 and 5
    or char_length(coalesce(p_body, '')) > 1200 then
    raise exception using errcode = '22023', message = 'Invalid marketplace review';
  end if;
  select q.* into request_row from public.custom_print_requests q
    where q.id = p_request_id and q.buyer_id = (select auth.uid()) and q.status = 'completed'
      and q.production_completed_at is not null and q.winning_store_id is not null for update;
  if not found or not exists (select 1 from public.seller_order_payments p
      where p.custom_print_request_id = p_request_id and p.buyer_id = (select auth.uid()) and p.status = 'paid') then
    raise exception using errcode = '42501', message = 'A completed paid print request is required to review';
  end if;
  insert into public.marketplace_reviews (buyer_id, custom_print_request_id, review_type, store_id, rating, body)
    values ((select auth.uid()), p_request_id, 'store', request_row.winning_store_id, p_rating, nullif(btrim(p_body), ''))
    returning id into review_id;
  return review_id;
end;
$$;
revoke all on function public.submit_custom_print_review(uuid, smallint, text) from public, anon;
grant execute on function public.submit_custom_print_review(uuid, smallint, text) to authenticated;

comment on table public.marketplace_reviews is 'Reviews are accepted only for verified paid marketplace purchases; admin approval controls public visibility.';
