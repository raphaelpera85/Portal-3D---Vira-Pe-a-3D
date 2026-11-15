create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated;

create function app_private.get_model_print_profile_viewer_data(p_profile_id uuid)
returns table(is_owner boolean, review_note text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(profile.user_id = (select auth.uid()), false),
    case when profile.user_id = (select auth.uid()) or public.is_catalog_admin()
      then profile.review_note else null::text end
  from public.model_print_profiles as profile
  where profile.id = p_profile_id
    and (
      (profile.sharing_scope in ('community', 'official') and profile.review_status = 'published')
      or profile.user_id = (select auth.uid())
      or public.is_catalog_admin()
    );
$$;

revoke all on function app_private.get_model_print_profile_viewer_data(uuid) from public, anon, authenticated;
grant execute on function app_private.get_model_print_profile_viewer_data(uuid) to anon, authenticated;
comment on function app_private.get_model_print_profile_viewer_data(uuid) is
  'Internal helper for the RLS-invoker public profile view; only returns ownership and owner/admin review notes.';

create or replace view public.visible_model_print_profiles
with (security_barrier = true, security_invoker = true)
as
select
  profile.id, profile.model_slug, profile.profile_name, profile.profile_type, profile.slicer,
  profile.printer_snapshot, profile.material_snapshot, profile.nozzle_snapshot, profile.layer_height_mm,
  profile.infill_percent, profile.wall_count, profile.supports, profile.orientation, profile.scale_percent,
  profile.quantity, profile.slicer_metrics, profile.created_at, profile.sharing_scope, profile.review_status,
  viewer.review_note, viewer.is_owner
from public.model_print_profiles as profile
cross join lateral app_private.get_model_print_profile_viewer_data(profile.id) as viewer;

revoke all on function public.get_model_print_profile_viewer_data(uuid) from public, anon, authenticated;
drop function public.get_model_print_profile_viewer_data(uuid);
