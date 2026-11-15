revoke all on function public.get_marketplace_best_sellers(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_best_sellers(text, text, integer, integer)
  to service_role;
comment on function public.get_marketplace_best_sellers(text, text, integer, integer) is
  'Server-only ranking of public products by paid units; exact unit counts are masked in the returned rows.';
