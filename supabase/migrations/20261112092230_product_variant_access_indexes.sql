create index buyer_cart_items_variant_product
  on public.buyer_cart_items (variant_id, product_id);
create index seller_purchase_order_items_variant_product
  on public.seller_purchase_order_items (variant_id, product_id);
create index product_quote_requests_variant_product
  on public.product_quote_requests (variant_id, product_id);

drop policy "Anyone can read variants for published products" on public.marketplace_product_variants;
drop policy "Makers can read variants for their products" on public.marketplace_product_variants;
drop policy "Marketplace admins can read product variants" on public.marketplace_product_variants;

create policy "Anyone can read variants for published products" on public.marketplace_product_variants
  for select to anon using (exists (
    select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
    where p.id = product_id and p.catalog_status = 'published' and s.status = 'published'
  ));
create policy "Authenticated users can read product variants" on public.marketplace_product_variants
  for select to authenticated using (
    exists (
      select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.id = product_id and p.catalog_status = 'published' and s.status = 'published'
    )
    or exists (
      select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.id = product_id and s.owner_user_id = (select auth.uid())
    )
    or (select public.is_catalog_admin())
  );
