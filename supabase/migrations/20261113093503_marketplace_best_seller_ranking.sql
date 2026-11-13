create function public.get_marketplace_best_sellers(
  p_category_slug text default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 24
)
returns table (product_id uuid, sold_units bigint, total_count bigint)
language sql stable security definer set search_path = '' as $$
  with paid_product_units as (
    select i.product_id, sum(i.quantity)::bigint as units
    from public.seller_purchase_order_items i
    join public.seller_purchase_orders o on o.id = i.order_id and o.status = 'accepted'
    join public.seller_order_payments payment on payment.order_id = o.id
      and payment.status in ('paid', 'partially_refunded')
    group by i.product_id

    union all

    select request.product_id, sum(request.quantity)::bigint as units
    from public.product_quote_requests request
    join public.seller_order_payments payment on payment.purchase_request_id = request.id
      and payment.status in ('paid', 'partially_refunded')
    where request.request_type = 'purchase' and request.status = 'accepted'
    group by request.product_id
  ),
  sold_products as (
    select product_id, sum(units)::bigint as units
    from paid_product_units
    group by product_id
  ),
  visible_products as (
    select sold.product_id, sold.units, product.published_at
    from sold_products sold
    join public.marketplace_products product on product.id = sold.product_id
      and product.catalog_status = 'published'
    join public.stores store on store.id = product.store_id and store.status = 'published'
    join public.product_categories category on category.id = product.category_id and category.active
    where (p_category_slug is null or category.slug = p_category_slug)
      and (nullif(btrim(p_search), '') is null or product.search_document @@
        websearch_to_tsquery('portuguese', left(btrim(p_search), 100)))
  ),
  total as (
    select count(*)::bigint as product_count from visible_products
  ),
  bounds as (
    select product_count,
      greatest(1, least(coalesce(p_page_size, 24), 24)) as page_size,
      greatest(1, least(coalesce(p_page, 1),
        greatest(1, ceil(product_count::numeric / greatest(1, least(coalesce(p_page_size, 24), 24)))::integer))) as page
    from total
  ),
  page as (
    select product.product_id, product.units
    from visible_products product
    order by product.units desc, product.published_at desc, product.product_id
    limit (select page_size from bounds)
    offset ((select page - 1 from bounds) * (select page_size from bounds))
  )
  select page.product_id, page.units, bounds.product_count
  from bounds left join page on true;
$$;

revoke all on function public.get_marketplace_best_sellers(text, text, integer, integer) from public;
grant execute on function public.get_marketplace_best_sellers(text, text, integer, integer) to anon, authenticated;
