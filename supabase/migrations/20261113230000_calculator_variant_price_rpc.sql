create function public.apply_calculated_product_variant_price(
  p_product_id uuid,
  p_variant_id uuid,
  p_expected_price_cents bigint,
  p_price_cents bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.marketplace_products%rowtype;
  variant_row public.marketplace_product_variants%rowtype;
  minimum_price numeric(12, 2);
begin
  if (select auth.uid()) is null
    or p_expected_price_cents not between 1 and 99999999999
    or p_price_cents not between 1 and 99999999999 then
    raise exception using errcode = '22023', message = 'Invalid variant price';
  end if;

  select p.* into product_row
  from public.marketplace_products p
  join public.stores s on s.id = p.store_id
  where p.id = p_product_id and p.created_by = (select auth.uid()) and s.owner_user_id = (select auth.uid())
    and p.listing_type = 'physical' and p.price_mode = 'fixed' and p.catalog_status in ('draft', 'published')
    and jsonb_typeof(p.product_properties -> 'variant_options') = 'object'
    and p.product_properties -> 'variant_options' <> '{}'::jsonb
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  for update of p;
  if not found then raise exception using errcode = '42501', message = 'Product is not available to this maker'; end if;

  select v.* into variant_row from public.marketplace_product_variants v
    where v.id = p_variant_id and v.product_id = p_product_id for update;
  if not found then raise exception using errcode = '22023', message = 'Variant is not part of this product'; end if;
  if round(variant_row.price_brl * 100)::bigint <> p_expected_price_cents then
    raise exception using errcode = '40001', message = 'STALE_VARIANT_PRICE';
  end if;
  if exists (select 1 from public.seller_order_payment_variant_reservations r
    where r.product_id = p_product_id and r.variant_id = p_variant_id and r.released_at is null and r.fulfilled_at is null) then
    raise exception using errcode = '55000', message = 'VARIANT_RESERVED';
  end if;

  update public.marketplace_product_variants
    set price_brl = p_price_cents::numeric / 100, updated_at = now()
    where id = p_variant_id and product_id = p_product_id;
  select min(v.price_brl) into minimum_price
    from public.marketplace_product_variants v where v.product_id = p_product_id;
  perform set_config('virapeca.internal_stock_adjustment', 'on', true);
  update public.marketplace_products set price_brl = minimum_price, updated_at = now()
    where id = p_product_id;
  perform set_config('virapeca.internal_stock_adjustment', 'off', true);
end;
$$;

revoke all on function public.apply_calculated_product_variant_price(uuid, uuid, bigint, bigint) from public, anon;
grant execute on function public.apply_calculated_product_variant_price(uuid, uuid, bigint, bigint) to authenticated;
