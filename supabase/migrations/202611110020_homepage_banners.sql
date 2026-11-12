create table public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  eyebrow text not null default '' check (char_length(eyebrow) <= 60),
  title text not null check (char_length(btrim(title)) between 4 and 90),
  description text not null check (char_length(btrim(description)) between 10 and 240),
  image_url text check (image_url is null or (image_url like 'https://%' and char_length(image_url) <= 2048)),
  image_alt text,
  action_label text not null check (char_length(btrim(action_label)) between 2 and 30),
  action_href text not null check (action_href like '/%' and action_href not like '//%' and action_href not like '%\\%'),
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_banners_media_alt_check check (
    (image_url is null and image_alt is null)
    or (image_url is not null and image_alt is not null and char_length(btrim(image_alt)) between 3 and 160)
  )
);

create index homepage_banners_public_order on public.homepage_banners (sort_order, created_at) where is_active;
alter table public.homepage_banners enable row level security;
revoke all on public.homepage_banners from anon, authenticated;
grant select on public.homepage_banners to anon, authenticated;
grant insert, update on public.homepage_banners to authenticated;

create policy "Anyone can read active homepage banners"
  on public.homepage_banners for select to anon, authenticated
  using (is_active);
create policy "Admins can read all homepage banners"
  on public.homepage_banners for select to authenticated
  using ((select public.is_catalog_admin()));
create policy "Admins manage homepage banners"
  on public.homepage_banners for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));
