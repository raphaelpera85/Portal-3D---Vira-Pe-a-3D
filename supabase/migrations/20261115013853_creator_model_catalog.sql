create table public.creator_model_submissions (
  id text primary key check (id ~ '^[a-f0-9]{12}$'),
  store_id uuid not null references public.stores (id) on delete cascade,
  submitted_by uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  category_slug text not null check (category_slug in (
    'suporte-para-oculos', 'chaveiros', 'infantil', 'jogos-de-mesa',
    'diversos', 'natal', 'acessorios-para-impressora-3d'
  )),
  asset_path text not null unique check (asset_path ~ '^models/[a-z0-9]+(-[a-z0-9]+)*\.3mf$'),
  tags text[] not null check (cardinality(tags) between 1 and 12 and array_position(tags, '') is null),
  creator_name text not null check (char_length(btrim(creator_name)) between 2 and 100),
  source_url text check (source_url is null or (source_url like 'https://%' and char_length(source_url) <= 2048)),
  rights_confirmed_at timestamptz not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'published', 'rejected', 'archived')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((review_status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (review_status <> 'pending' and reviewed_by is not null and reviewed_at is not null))
);

create index creator_model_review_queue on public.creator_model_submissions (created_at, id) where review_status = 'pending';
create index creator_model_public_catalog on public.creator_model_submissions (category_slug, created_at desc, id) where review_status = 'published';

alter table public.creator_model_submissions enable row level security;
revoke all on public.creator_model_submissions from public, anon, authenticated;
grant select (id, name, category_slug, asset_path, tags, creator_name, source_url, created_at) on public.creator_model_submissions to anon;
grant select on public.creator_model_submissions to authenticated;
grant insert (id, store_id, submitted_by, name, category_slug, asset_path, tags, creator_name, source_url, rights_confirmed_at) on public.creator_model_submissions to authenticated;
grant update (review_status, review_note, reviewed_by, reviewed_at, updated_at) on public.creator_model_submissions to authenticated;

create policy "Anyone can read published creator models"
  on public.creator_model_submissions for select to anon, authenticated
  using (review_status = 'published');
create policy "Creators can read their own model submissions"
  on public.creator_model_submissions for select to authenticated
  using (submitted_by = (select auth.uid()));
create policy "Marketplace admins can read all creator models"
  on public.creator_model_submissions for select to authenticated
  using ((select public.is_catalog_admin()));
create policy "Published store owners can submit models for review"
  on public.creator_model_submissions for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and review_status = 'pending'
    and review_note is null
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.stores s
      where s.id = store_id and s.owner_user_id = (select auth.uid()) and s.status = 'published'
    )
    and exists (
      select 1 from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
    )
  );
create policy "Marketplace admins can review creator models"
  on public.creator_model_submissions for update to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));
