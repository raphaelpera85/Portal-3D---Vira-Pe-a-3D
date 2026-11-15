create or replace function public.validate_product_stock_quantity()
returns trigger language plpgsql set search_path = '' as $$
declare
  product_stock integer;
  variant_stock integer;
  product_price numeric(12, 2);
  product_price_mode text;
  product_listing_type text;
  product_catalog_status text;
  variant_price numeric(12, 2);
  variant_options jsonb;
  product_quantity integer := 0;
  variant_quantity integer := 0;
begin
  if tg_table_name = 'product_quote_requests' then
    if new.request_type <> 'purchase' then return new; end if;
  end if;
  select p.stock_quantity, p.price_brl, p.price_mode, p.listing_type, p.catalog_status
    into product_stock, product_price, product_price_mode, product_listing_type, product_catalog_status
    from public.marketplace_products p where p.id = new.product_id for update;
  if not found then raise exception using errcode = '22023', message = 'Product is unavailable'; end if;
  if new.variant_id is not null then
    select v.stock_quantity, v.price_brl, v.variant_options into variant_stock, variant_price, variant_options
      from public.marketplace_product_variants v
      where v.id = new.variant_id and v.product_id = new.product_id for update;
    if not found then raise exception using errcode = '22023', message = 'Product variant is unavailable'; end if;
  end if;
  if tg_table_name = 'seller_purchase_order_items' then
    if product_price_mode <> 'fixed' or product_listing_type <> 'physical' or product_catalog_status <> 'published' then
      raise exception using errcode = '22023', message = 'Product is unavailable for checkout';
    end if;
    if new.variant_id is not null then
      if variant_options is distinct from new.variant_options or variant_price is distinct from new.unit_price_brl then
        raise exception using errcode = '22023', message = 'Product variant price changed';
      end if;
    elsif exists (select 1 from public.marketplace_product_variants v where v.product_id = new.product_id)
      or product_price is distinct from new.unit_price_brl then
      raise exception using errcode = '22023', message = 'Product price changed';
    end if;
  end if;
  if tg_table_name = 'buyer_cart_items' then
    select coalesce(sum(i.quantity), 0)::integer into product_quantity from public.buyer_cart_items i
      where i.cart_id = new.cart_id and i.product_id = new.product_id and (tg_op <> 'UPDATE' or i.id <> new.id);
    if new.variant_id is not null then
      select coalesce(sum(i.quantity), 0)::integer into variant_quantity from public.buyer_cart_items i
        where i.cart_id = new.cart_id and i.variant_id = new.variant_id and (tg_op <> 'UPDATE' or i.id <> new.id);
    end if;
  elsif tg_table_name = 'seller_purchase_order_items' then
    select coalesce(sum(i.quantity), 0)::integer into product_quantity from public.seller_purchase_order_items i
      where i.order_id = new.order_id and i.product_id = new.product_id;
    if new.variant_id is not null then
      select coalesce(sum(i.quantity), 0)::integer into variant_quantity from public.seller_purchase_order_items i
        where i.order_id = new.order_id and i.variant_id = new.variant_id;
    end if;
  end if;
  if product_stock is not null and product_quantity + new.quantity > product_stock then
    raise exception using errcode = '22023', message = 'Requested quantity exceeds available product stock';
  end if;
  if variant_stock is not null and variant_quantity + new.quantity > variant_stock then
    raise exception using errcode = '22023', message = 'Requested quantity exceeds available variant stock';
  end if;
  return new;
end;
$$;
