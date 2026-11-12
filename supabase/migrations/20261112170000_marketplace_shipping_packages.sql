alter table public.marketplace_products
  add column package_weight_g numeric(10, 2),
  add column package_length_cm numeric(8, 2),
  add column package_width_cm numeric(8, 2),
  add column package_height_cm numeric(8, 2),
  add constraint marketplace_products_package_dimensions_check check (
    (package_weight_g is null and package_length_cm is null and package_width_cm is null and package_height_cm is null)
    or (
      package_weight_g between 1 and 100000
      and package_length_cm between 0.1 and 500
      and package_width_cm between 0.1 and 500
      and package_height_cm between 0.1 and 500
    )
  );

create function public.save_maker_product_shipping_package(
  p_product_id uuid, p_weight_g numeric, p_length_cm numeric, p_width_cm numeric, p_height_cm numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = current_user_id and r.role = 'maker'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Maker account required';
  end if;
  if not (
    (p_weight_g is null and p_length_cm is null and p_width_cm is null and p_height_cm is null)
    or (
      p_weight_g between 1 and 100000 and p_length_cm between 0.1 and 500
      and p_width_cm between 0.1 and 500 and p_height_cm between 0.1 and 500
    )
  ) then
    raise exception using errcode = '22023', message = 'Invalid shipping package';
  end if;
  update public.marketplace_products p set
    package_weight_g = p_weight_g, package_length_cm = p_length_cm,
    package_width_cm = p_width_cm, package_height_cm = p_height_cm, updated_at = now()
  from public.stores s
  where p.id = p_product_id and p.store_id = s.id and s.owner_user_id = current_user_id
    and p.listing_type = 'physical' and p.catalog_status <> 'archived';
  if not found then raise exception using errcode = '42501', message = 'Product is not available to this maker'; end if;
end;
$$;

revoke all on function public.save_maker_product_shipping_package(uuid, numeric, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.save_maker_product_shipping_package(uuid, numeric, numeric, numeric, numeric) to authenticated;
