create table public.buyer_product_favorites (
  buyer_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.marketplace_products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, product_id)
);

alter table public.buyer_product_favorites enable row level security;
revoke all on public.buyer_product_favorites from anon, authenticated;
grant select on public.buyer_product_favorites to authenticated;
create policy "Buyers can read their own favorites"
  on public.buyer_product_favorites for select to authenticated
  using (
    buyer_id = (select auth.uid())
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
  );

create function public.set_product_favorite(p_product_id uuid, p_favorite boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_product_id is null or p_favorite is null
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;

  if p_favorite then
    if not exists (
      select 1 from public.marketplace_products p
      join public.stores s on s.id = p.store_id
      join public.product_categories c on c.id = p.category_id
      where p.id = p_product_id and p.catalog_status = 'published' and s.status = 'published' and c.active
    ) then raise exception using errcode = '22023', message = 'Product is not available'; end if;

    insert into public.buyer_product_favorites (buyer_id, product_id)
      values ((select auth.uid()), p_product_id) on conflict do nothing;
  else
    delete from public.buyer_product_favorites
      where buyer_id = (select auth.uid()) and product_id = p_product_id;
  end if;
end;
$$;

revoke all on function public.set_product_favorite(uuid, boolean) from public, anon;
grant execute on function public.set_product_favorite(uuid, boolean) to authenticated;
