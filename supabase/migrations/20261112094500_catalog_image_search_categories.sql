insert into public.product_categories (name, slug, sort_order)
values
  ('Suporte para Óculos', 'suporte-para-oculos', 21),
  ('Infantil', 'infantil', 22)
on conflict (slug) do update set name = excluded.name, active = true, sort_order = excluded.sort_order;

create table public.catalog_image_search_daily_usage (
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  usage_date date not null,
  searches_used smallint not null check (searches_used between 1 and 5),
  primary key (ip_hash, usage_date)
);

alter table public.catalog_image_search_daily_usage enable row level security;
revoke all on public.catalog_image_search_daily_usage from public, anon, authenticated;

create function public.consume_catalog_image_search_quota(p_ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare used boolean;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid quota key';
  end if;

  delete from public.catalog_image_search_daily_usage
    where usage_date < (now() at time zone 'utc')::date - 14;
  insert into public.catalog_image_search_daily_usage (ip_hash, usage_date, searches_used)
    values (p_ip_hash, (now() at time zone 'utc')::date, 1)
    on conflict (ip_hash, usage_date) do update
      set searches_used = public.catalog_image_search_daily_usage.searches_used + 1
      where public.catalog_image_search_daily_usage.searches_used < 5
    returning true into used;
  return coalesce(used, false);
end; $$;

revoke all on function public.consume_catalog_image_search_quota(text) from public, anon, authenticated;
grant execute on function public.consume_catalog_image_search_quota(text) to service_role;
