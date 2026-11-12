alter table public.product_quote_requests
  add column variant_options jsonb not null default '{}'::jsonb
    check (jsonb_typeof(variant_options) = 'object');

grant execute on function public.valid_product_variant_options(jsonb, jsonb),
  public.product_variant_product_name(text, jsonb) to authenticated;

create function public.prepare_product_purchase_variant_name()
returns trigger
language plpgsql
set search_path = ''
as $$
declare canonical_name text;
begin
  if new.request_type <> 'purchase' or new.variant_options = '{}'::jsonb then return new; end if;
  select p.name into canonical_name from public.marketplace_products p where p.id = new.product_id;
  if found then new.product_name := public.product_variant_product_name(canonical_name, new.variant_options); end if;
  return new;
end;
$$;
revoke all on function public.prepare_product_purchase_variant_name() from public, anon, authenticated;
create trigger product_purchase_variant_name
  before insert on public.product_quote_requests
  for each row execute function public.prepare_product_purchase_variant_name();

drop policy "Buyers can request published physical products" on public.product_quote_requests;
create policy "Buyers can request published physical products"
  on public.product_quote_requests for insert to authenticated
  with check (
    buyer_id = (select auth.uid()) and status = 'pending' and maker_read_at is null
    and (due_date is null or due_date >= current_date) and license_type is null
    and exists (
      select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.id = product_quote_requests.product_id and p.store_id = product_quote_requests.store_id
        and p.catalog_status = 'published' and p.listing_type <> 'digital' and s.status = 'published'
        and product_quote_requests.store_name = s.name
        and (
          (product_quote_requests.request_type = 'quote' and product_quote_requests.variant_options = '{}'::jsonb
            and product_quote_requests.product_name = p.name and p.price_mode in ('quote', 'from')
            and product_quote_requests.unit_price_brl is null)
          or
          (product_quote_requests.request_type = 'purchase' and p.price_mode = 'fixed'
            and product_quote_requests.unit_price_brl = p.price_brl
            and public.valid_product_variant_options(coalesce(p.product_properties -> 'variant_options', '{}'::jsonb), product_quote_requests.variant_options)
            and product_quote_requests.product_name = public.product_variant_product_name(p.name, product_quote_requests.variant_options))
        )
    )
  );
