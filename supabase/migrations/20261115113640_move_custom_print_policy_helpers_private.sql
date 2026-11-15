-- These SECURITY DEFINER helpers are required by RLS policies, not as Data API RPCs.
alter function public.can_view_custom_print_request(uuid) set schema app_private;
alter function public.can_view_custom_print_target(uuid) set schema app_private;
alter function public.can_view_custom_print_offer(uuid, uuid) set schema app_private;

revoke all on function app_private.can_view_custom_print_request(uuid),
  app_private.can_view_custom_print_target(uuid),
  app_private.can_view_custom_print_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.can_view_custom_print_request(uuid),
  app_private.can_view_custom_print_target(uuid),
  app_private.can_view_custom_print_offer(uuid, uuid) to authenticated;
