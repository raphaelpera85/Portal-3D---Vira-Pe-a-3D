create function public.get_my_digital_asset_download_stats()
returns table (request_id uuid, download_count bigint, last_download_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select downloads.request_id, count(*)::bigint, max(downloads.created_at)
  from public.digital_asset_downloads as downloads
  where downloads.buyer_id = (select auth.uid())
  group by downloads.request_id;
$$;

revoke all on function public.get_my_digital_asset_download_stats() from public, anon;
grant execute on function public.get_my_digital_asset_download_stats() to authenticated;
