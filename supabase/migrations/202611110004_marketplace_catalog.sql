create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.product_categories (id) on delete set null,
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  logo_url text check (logo_url is null or logo_url like 'https://%'),
  banner_url text check (banner_url is null or banner_url like 'https://%'),
  city text,
  state_code char(2) check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  status text not null default 'pending' check (status in ('pending', 'published', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  category_id uuid not null references public.product_categories (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  listing_type text not null check (listing_type in ('physical', 'digital', 'print_service')),
  fulfillment_mode text not null check (fulfillment_mode in ('ready_to_ship', 'made_to_order', 'digital', 'quote')),
  price_mode text not null default 'quote' check (price_mode in ('fixed', 'from', 'quote')),
  price_brl numeric(12, 2) check (price_brl is null or price_brl > 0),
  currency char(3) not null default 'BRL' check (currency = 'BRL'),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  tags text[] not null default '{}',
  search_document tsvector not null default ''::tsvector,
  color_theme text not null default 'blue' check (color_theme in ('blue', 'green', 'sand', 'pink')),
  visual text check (visual is null or visual in ('vase', 'dragon', 'organizer', 'keychain')),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  preparation_days smallint check (preparation_days is null or preparation_days >= 0),
  product_properties jsonb not null default '{}'::jsonb check (jsonb_typeof(product_properties) = 'object'),
  catalog_status text not null default 'draft' check (catalog_status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((price_mode = 'quote' and price_brl is null) or (price_mode in ('fixed', 'from') and price_brl is not null)),
  check (catalog_status <> 'published' or published_at is not null)
);

create function public.update_marketplace_product_search_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_document :=
    setweight(to_tsvector('portuguese', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(new.tags, ' '), '')), 'C');
  return new;
end;
$$;

revoke all on function public.update_marketplace_product_search_document() from public, anon, authenticated;

create trigger marketplace_products_update_search_document
  before insert or update of name, description, tags on public.marketplace_products
  for each row execute function public.update_marketplace_product_search_document();

create index product_categories_active_order on public.product_categories (sort_order, name) where active;
create index stores_public_lookup on public.stores (slug) where status = 'published';
create index marketplace_products_public_lookup on public.marketplace_products (created_at desc, id) where catalog_status = 'published';
create index marketplace_products_category_lookup on public.marketplace_products (category_id, created_at desc) where catalog_status = 'published';
create index marketplace_products_store_lookup on public.marketplace_products (store_id, catalog_status);
create index marketplace_products_search on public.marketplace_products using gin (search_document) where catalog_status = 'published';

alter table public.product_categories enable row level security;
alter table public.stores enable row level security;
alter table public.marketplace_products enable row level security;

revoke all on public.product_categories, public.stores, public.marketplace_products from anon, authenticated;
grant select on public.product_categories, public.stores, public.marketplace_products to anon, authenticated;
grant insert, update, delete on public.product_categories, public.stores, public.marketplace_products to authenticated;

create policy "Anyone can read active product categories"
  on public.product_categories for select to anon, authenticated using (active);
create policy "Marketplace admins can manage product categories"
  on public.product_categories for all to authenticated
  using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

create policy "Anyone can read published stores"
  on public.stores for select to anon, authenticated using (status = 'published');
create policy "Owners can read their own stores"
  on public.stores for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy "Marketplace admins can manage stores"
  on public.stores for all to authenticated
  using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

create policy "Anyone can read published products in published stores"
  on public.marketplace_products for select to anon, authenticated
  using (
    catalog_status = 'published'
    and exists (select 1 from public.stores s where s.id = store_id and s.status = 'published')
    and exists (select 1 from public.product_categories c where c.id = category_id and c.active)
  );
create policy "Product owners can read their own listings"
  on public.marketplace_products for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid())));
create policy "Marketplace admins can manage products"
  on public.marketplace_products for all to authenticated
  using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

insert into public.product_categories (name, slug, sort_order) values
  ('Chaveiros', 'chaveiros', 1),
  ('Pets', 'pets', 2),
  ('Miniaturas', 'miniaturas', 3),
  ('RPG e jogos de mesa', 'rpg-jogos-de-mesa', 4),
  ('Anime e cultura geek', 'anime-cultura-geek', 5),
  ('Decoração', 'decoracao', 6),
  ('Brinquedos', 'brinquedos', 7),
  ('Cosplay', 'cosplay', 8),
  ('Peças automotivas', 'pecas-automotivas', 9),
  ('Peças de reposição', 'pecas-de-reposicao', 10),
  ('Engenharia', 'engenharia', 11),
  ('Protótipos', 'prototipos', 12),
  ('Brindes', 'brindes', 13),
  ('Organização', 'organizacao', 14),
  ('Educação', 'educacao', 15),
  ('Arquitetura', 'arquitetura', 16),
  ('Produtos personalizados', 'produtos-personalizados', 17),
  ('Arquivos digitais', 'arquivos-digitais', 18),
  ('Modelagem 3D', 'modelagem-3d', 19),
  ('Impressão sob encomenda', 'impressao-sob-encomenda', 20)
on conflict (slug) do nothing;
