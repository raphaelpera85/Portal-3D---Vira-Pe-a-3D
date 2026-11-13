grant select (status) on public.marketplace_reviews to anon;

create function public.get_recommended_marketplace_stores()
returns table (
  store_id uuid,
  store_name text,
  store_slug text,
  published_product_count bigint,
  review_count bigint,
  average_rating numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.name, s.slug,
    count(distinct p.id)::bigint,
    count(distinct r.id)::bigint,
    avg(r.rating)::numeric
  from public.stores s
  join public.marketplace_products p
    on p.store_id = s.id and p.catalog_status = 'published'
  left join public.marketplace_reviews r
    on r.store_id = s.id and r.review_type = 'store' and r.status = 'published'
  where s.status = 'published'
  group by s.id, s.name, s.slug, s.created_at
  order by count(r.id) > 0 desc,
    avg(r.rating) desc nulls last,
    count(distinct r.id) desc,
    count(distinct p.id) desc,
    s.created_at desc
  limit 4;
$$;

revoke all on function public.get_recommended_marketplace_stores() from public;
grant execute on function public.get_recommended_marketplace_stores() to anon, authenticated;
