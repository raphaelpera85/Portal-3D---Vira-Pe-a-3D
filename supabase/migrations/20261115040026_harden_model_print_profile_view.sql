revoke select on public.model_print_profiles from anon, authenticated;
revoke select (id, model_slug, sharing_scope, review_status) on public.model_print_profiles from authenticated;

grant select (
  id, model_slug, profile_name, profile_type, slicer, printer_snapshot, material_snapshot, nozzle_snapshot,
  layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, slicer_metrics,
  created_at, sharing_scope, review_status
) on public.model_print_profiles to anon, authenticated;

drop view public.visible_model_print_profiles;

create function public.get_model_print_profile_viewer_data(p_profile_id uuid)
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

revoke all on function public.get_model_print_profile_viewer_data(uuid) from public;
grant execute on function public.get_model_print_profile_viewer_data(uuid) to anon, authenticated;
comment on function public.get_model_print_profile_viewer_data(uuid) is
  'For a profile already visible under RLS, return owner status and reveal its review note only to its owner or a catalog administrator.';

create view public.visible_model_print_profiles
with (security_barrier = true, security_invoker = true)
as
select
  profile.id, profile.model_slug, profile.profile_name, profile.profile_type, profile.slicer,
  profile.printer_snapshot, profile.material_snapshot, profile.nozzle_snapshot, profile.layer_height_mm,
  profile.infill_percent, profile.wall_count, profile.supports, profile.orientation, profile.scale_percent,
  profile.quantity, profile.slicer_metrics, profile.created_at, profile.sharing_scope, profile.review_status,
  viewer.review_note, viewer.is_owner
from public.model_print_profiles as profile
cross join lateral public.get_model_print_profile_viewer_data(profile.id) as viewer;

grant select on public.visible_model_print_profiles to anon, authenticated;
comment on view public.visible_model_print_profiles is
  'Expose only rows permitted by the querying role’s RLS policies; a narrowly scoped function masks author IDs and private review notes.';
