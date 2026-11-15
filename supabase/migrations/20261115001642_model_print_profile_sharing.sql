alter table public.model_print_profiles
  add column sharing_scope text not null default 'private' check (sharing_scope in ('private', 'community', 'official')),
  add column review_status text not null default 'draft' check (review_status in ('draft', 'pending', 'published', 'rejected')),
  add column reviewed_by uuid references auth.users (id) on delete restrict,
  add column reviewed_at timestamptz,
  add column review_note text check (review_note is null or char_length(review_note) <= 1000),
  add constraint model_print_profiles_scope_status check (
    (sharing_scope = 'private' and review_status = 'draft')
    or (sharing_scope = 'community' and review_status in ('pending', 'published', 'rejected'))
    or (sharing_scope = 'official' and review_status = 'published')
  ),
  add constraint model_print_profiles_review_state check (
    (review_status in ('draft', 'pending') and reviewed_by is null and reviewed_at is null)
    or (review_status in ('published', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  );

create index model_print_profiles_public_recent on public.model_print_profiles (model_slug, created_at desc)
  where sharing_scope in ('community', 'official') and review_status = 'published';

drop policy "Users manage their own private model print profiles" on public.model_print_profiles;
revoke select on public.model_print_profiles from anon, authenticated;
grant select (id, model_slug, sharing_scope, review_status) on public.model_print_profiles to authenticated;

create policy "Users read their own model print profiles"
  on public.model_print_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Anyone can read published shared model print profiles"
  on public.model_print_profiles for select to anon, authenticated
  using (sharing_scope in ('community', 'official') and review_status = 'published');

create policy "Users create private or community model print profiles"
  on public.model_print_profiles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and ((sharing_scope = 'private' and review_status = 'draft') or (sharing_scope = 'community' and review_status = 'pending'))
    and reviewed_by is null and reviewed_at is null
  );

create policy "Users revise or withdraw their community model print profiles"
  on public.model_print_profiles for update to authenticated
  using (user_id = (select auth.uid()) and sharing_scope in ('private', 'community'))
  with check (
    user_id = (select auth.uid())
    and ((sharing_scope = 'private' and review_status = 'draft') or (sharing_scope = 'community' and review_status = 'pending'))
    and reviewed_by is null and reviewed_at is null
  );

create policy "Users delete private or unreviewed community model print profiles"
  on public.model_print_profiles for delete to authenticated
  using (
    user_id = (select auth.uid())
    and ((sharing_scope = 'private' and review_status = 'draft') or (sharing_scope = 'community' and review_status in ('pending', 'rejected')))
  );

create policy "Catalog admins curate shared model print profiles"
  on public.model_print_profiles for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

create trigger audit_model_print_profile_review_status
  after update of review_status on public.model_print_profiles
  for each row execute function public.audit_admin_status_change('review_status');

create trigger audit_model_print_profile_sharing_scope
  after update of sharing_scope on public.model_print_profiles
  for each row execute function public.audit_admin_status_change('sharing_scope');

create view public.visible_model_print_profiles with (security_barrier = true) as
select
  id, model_slug, profile_name, profile_type, slicer, printer_snapshot, material_snapshot, nozzle_snapshot,
  layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, slicer_metrics,
  created_at, sharing_scope, review_status,
  case when user_id = (select auth.uid()) or exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'::public.app_role
  ) then review_note else null end as review_note,
  user_id = (select auth.uid()) as is_owner
from public.model_print_profiles
where (sharing_scope in ('community', 'official') and review_status = 'published')
  or user_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'::public.app_role
  );

grant select on public.visible_model_print_profiles to anon, authenticated;
comment on view public.visible_model_print_profiles is
  'Expose only published shared profiles and each owner’s own profiles; hide author IDs and private review notes.';
