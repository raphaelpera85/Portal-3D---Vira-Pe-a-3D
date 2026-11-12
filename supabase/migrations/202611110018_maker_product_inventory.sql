create function public.update_maker_product_inventory(
  p_product_id uuid, p_fulfillment_mode text, p_stock_quantity integer, p_preparation_days smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_price_mode text;
  current_listing_type text;
begin
  if current_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = current_user_id and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Maker account required';
  end if;

  select p.price_mode, p.listing_type into current_price_mode, current_listing_type
    from public.marketplace_products p join public.stores s on s.id = p.store_id
    where p.id = p_product_id and s.owner_user_id = current_user_id and p.catalog_status <> 'archived'
    for update of p;
  if not found then raise exception using errcode = '42501', message = 'Product not found'; end if;
  if current_listing_type <> 'physical' then
    raise exception using errcode = '22023', message = 'Inventory is only available for physical listings';
  end if;
  if current_price_mode = 'quote' then
    if p_fulfillment_mode <> 'quote' or p_stock_quantity is not null or p_preparation_days is not null then
      raise exception using errcode = '22023', message = 'Quote products do not use tracked stock';
    end if;
  elsif current_price_mode in ('fixed', 'from') then
    if (p_fulfillment_mode = 'ready_to_ship' and (p_stock_quantity is null or p_stock_quantity not between 0 and 1000000))
      or (p_fulfillment_mode = 'made_to_order' and p_stock_quantity is not null)
      or p_fulfillment_mode not in ('ready_to_ship', 'made_to_order')
      or (p_preparation_days is not null and p_preparation_days not between 0 and 365) then
      raise exception using errcode = '22023', message = 'Invalid product inventory';
    end if;
  else
    raise exception using errcode = '22023', message = 'Invalid product price mode';
  end if;

  update public.marketplace_products set fulfillment_mode = p_fulfillment_mode,
    stock_quantity = p_stock_quantity, preparation_days = p_preparation_days, updated_at = now()
    where id = p_product_id;
end;
$$;

create function public.validate_product_stock_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  available_stock integer;
begin
  if tg_table_name = 'product_quote_requests' and new.request_type <> 'purchase' then return new; end if;
  select p.stock_quantity into available_stock from public.marketplace_products p where p.id = new.product_id for update;
  if not found then raise exception using errcode = '22023', message = 'Product is unavailable'; end if;
  if available_stock is not null and new.quantity > available_stock then
    raise exception using errcode = '22023', message = 'Requested quantity exceeds available stock';
  end if;
  return new;
end;
$$;

create trigger validate_cart_item_stock_before_write
  before insert or update of product_id, quantity on public.buyer_cart_items
  for each row execute function public.validate_product_stock_quantity();
create trigger validate_direct_purchase_stock_before_insert
  before insert on public.product_quote_requests
  for each row execute function public.validate_product_stock_quantity();
create trigger validate_cart_order_stock_before_insert
  before insert on public.seller_purchase_order_items
  for each row execute function public.validate_product_stock_quantity();

revoke all on function public.update_maker_product_inventory(uuid, text, integer, smallint) from public, anon, authenticated;
revoke all on function public.validate_product_stock_quantity() from public, anon, authenticated;
grant execute on function public.update_maker_product_inventory(uuid, text, integer, smallint) to authenticated;
