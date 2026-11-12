create table public.designer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  biography text not null check (char_length(btrim(biography)) between 30 and 1200),
  portfolio_url text check (portfolio_url is null or (portfolio_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' and char_length(portfolio_url) <= 500)),
  city text check (city is null or char_length(city) <= 60),
  state_code char(2) check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  specialties text[] not null check (cardinality(specialties) between 1 and 8),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'suspended')),
  response_note text check (response_note is null or char_length(response_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('published', 'rejected', 'suspended') and reviewed_by is not null and reviewed_at is not null))
);

create index designer_profiles_public_recent on public.designer_profiles (updated_at desc, id) where status = 'published';
create index designer_profiles_review_queue on public.designer_profiles (created_at) where status = 'pending';
alter table public.designer_profiles enable row level security;
revoke all on public.designer_profiles from anon, authenticated;
grant select (slug, display_name, biography, portfolio_url, city, state_code, specialties, status, updated_at)
  on public.designer_profiles to anon;
grant select (id, user_id, slug, display_name, biography, portfolio_url, city, state_code, specialties, status, response_note, created_at, updated_at)
  on public.designer_profiles to authenticated;
create policy "Anyone can read published designer profiles" on public.designer_profiles for select to anon, authenticated
  using (status = 'published');
create policy "Designers can read their own profile" on public.designer_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Admins can read all designer profiles" on public.designer_profiles for select to authenticated
  using ((select public.is_catalog_admin()));

create function public.submit_designer_profile(p_slug text, p_display_name text, p_biography text,
  p_portfolio_url text, p_city text, p_state_code text, p_specialties text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  profile_id uuid;
begin
  if actor_id is null or not exists (select 1 from public.user_roles r where r.user_id = actor_id and r.role in ('buyer'::public.app_role, 'designer'::public.app_role))
    or p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 80
    or p_biography is null or char_length(btrim(p_biography)) not between 30 and 1200
    or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 80
    or (p_portfolio_url is not null and (p_portfolio_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' or char_length(p_portfolio_url) > 500))
    or (p_city is not null and char_length(p_city) > 60)
    or (p_state_code is not null and p_state_code !~ '^[A-Z]{2}$')
    or p_specialties is null or cardinality(p_specialties) not between 1 and 8
    or exists (select 1 from unnest(p_specialties) specialty where specialty is null or char_length(btrim(specialty)) not between 2 and 40 or specialty ~ '[[:cntrl:]]') then
    raise exception using errcode = '22023', message = 'Invalid designer profile';
  end if;

  insert into public.designer_profiles (user_id, slug, display_name, biography, portfolio_url, city, state_code, specialties)
    values (actor_id, p_slug, btrim(p_display_name), btrim(p_biography), p_portfolio_url, nullif(btrim(p_city), ''), p_state_code, p_specialties)
    on conflict (user_id) do update set display_name = excluded.display_name, biography = excluded.biography,
      portfolio_url = excluded.portfolio_url, city = excluded.city, state_code = excluded.state_code,
      specialties = excluded.specialties,
      status = 'pending',
      response_note = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
    where public.designer_profiles.status in ('pending', 'rejected', 'published')
    returning id into profile_id;
  if profile_id is null then raise exception using errcode = '42501', message = 'Designer profile cannot be edited'; end if;
  return profile_id;
end;
$$;

create function public.review_designer_profile(p_profile_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare profile_row public.designer_profiles%rowtype;
begin
  if not public.is_catalog_admin() or (p_note is not null and char_length(p_note) > 1000)
    or p_decision is null or p_decision not in ('approved', 'rejected', 'suspended', 'reinstated') then
    raise exception using errcode = '42501', message = 'Invalid designer profile review';
  end if;
  select d.* into profile_row from public.designer_profiles d where d.id = p_profile_id for update;
  if not found or not ((profile_row.status in ('pending', 'rejected') and p_decision in ('approved', 'rejected'))
    or (profile_row.status = 'published' and p_decision = 'suspended')
    or (profile_row.status = 'suspended' and p_decision = 'reinstated')) then
    raise exception using errcode = '22023', message = 'Designer profile cannot be reviewed in this state';
  end if;
  update public.designer_profiles set status = case p_decision when 'approved' then 'published' when 'reinstated' then 'published' else p_decision end,
    response_note = case when p_decision in ('rejected', 'suspended') then nullif(btrim(p_note), '') else null end,
    reviewed_by = (select auth.uid()), reviewed_at = now(), updated_at = now()
    where id = p_profile_id;
  if p_decision in ('approved', 'reinstated') then
    insert into public.user_roles (user_id, role) values (profile_row.user_id, 'designer'::public.app_role) on conflict do nothing;
    insert into public.user_roles (user_id, role) values (profile_row.user_id, 'maker'::public.app_role) on conflict do nothing;
    insert into public.stores (owner_user_id, name, slug, description, city, state_code, status)
      values (profile_row.user_id, profile_row.display_name,
        'designer-' || left(replace(profile_row.user_id::text, '-', ''), 12), profile_row.biography,
        profile_row.city, profile_row.state_code, 'pending')
      on conflict (owner_user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.submit_designer_profile(text, text, text, text, text, text, text[]),
  public.review_designer_profile(uuid, text, text) from public, anon;
grant execute on function public.submit_designer_profile(text, text, text, text, text, text, text[]),
  public.review_designer_profile(uuid, text, text) to authenticated;
