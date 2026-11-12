alter table public.maker_consignment_items
  add column commission_fixed_fee_brl numeric(12, 2) not null default 0
  check (commission_fixed_fee_brl between 0 and 1000000);

create function public.create_maker_consignment_item_with_fees(
  p_establishment text,
  p_product_name text,
  p_quantity integer,
  p_unit_cost_brl numeric,
  p_sale_price_brl numeric,
  p_commission_percent numeric,
  p_commission_fixed_fee_brl numeric,
  p_product_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_item uuid;
begin
  if p_commission_fixed_fee_brl is null or p_commission_fixed_fee_brl not between 0 and 1000000 then
    raise exception using errcode = '22023', message = 'Invalid consignment fee';
  end if;

  new_item := public.create_maker_consignment_item(
    p_establishment, p_product_name, p_quantity, p_unit_cost_brl,
    p_sale_price_brl, p_commission_percent, p_product_id
  );
  update public.maker_consignment_items
    set commission_fixed_fee_brl = p_commission_fixed_fee_brl
    where id = new_item;
  return new_item;
end;
$$;

revoke all on function public.create_maker_consignment_item_with_fees(text, text, integer, numeric, numeric, numeric, numeric, uuid) from public, anon;
grant execute on function public.create_maker_consignment_item_with_fees(text, text, integer, numeric, numeric, numeric, numeric, uuid) to authenticated;
