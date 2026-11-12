create table public.maker_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_email text not null check (btrim(contact_email) <> ''),
  business_name text not null check (btrim(business_name) <> '' and char_length(business_name) <= 80),
  description text not null check (char_length(btrim(description)) between 30 and 1200),
  portfolio_url text check (portfolio_url is null or (portfolio_url like 'https://%' and char_length(portfolio_url) <= 500)),
  city text check (city is null or char_length(city) <= 60),
  state_code char(2) check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  response_note text check (response_note is null or char_length(response_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null) or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null))
);

create unique index one_pending_maker_application_per_user
  on public.maker_applications (user_id) where status = 'pending';
create index maker_applications_review_queue on public.maker_applications (created_at) where status = 'pending';
create unique index stores_single_owner on public.stores (owner_user_id);

alter table public.maker_applications enable row level security;
revoke all on public.maker_applications from anon, authenticated;
grant select, insert on public.maker_applications to authenticated;
grant update on public.maker_applications to authenticated;

create policy "Users can read their maker applications"
  on public.maker_applications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Buyers can submit pending maker applications"
  on public.maker_applications for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and response_note is null
    and not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );
create policy "Marketplace admins can review maker applications"
  on public.maker_applications for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

create policy "Approved makers can create a pending store"
  on public.stores for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );
create policy "Approved makers can update their store details"
  on public.stores for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  )
  with check (
    owner_user_id = (select auth.uid())
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create policy "Approved makers can create draft products in their published store"
  on public.marketplace_products for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and catalog_status = 'draft'
    and exists (
      select 1 from public.stores s
      where s.id = store_id and s.owner_user_id = (select auth.uid()) and s.status = 'published'
    )
    and exists (
      select 1 from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
    )
    and exists (select 1 from public.product_categories c where c.id = category_id and c.active)
  );
create policy "Approved makers can update their own products"
  on public.marketplace_products for update to authenticated
  using (
    created_by = (select auth.uid())
    and exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  )
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    and exists (select 1 from public.product_categories c where c.id = category_id and c.active)
  );
create policy "Approved makers can delete their own products"
  on public.marketplace_products for delete to authenticated
  using (
    created_by = (select auth.uid())
    and exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
  );

create function public.prevent_owner_store_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not public.is_catalog_admin() then
    raise exception using errcode = '42501', message = 'Only marketplace administrators can change store status';
  end if;
  return new;
end;
$$;

create function public.prevent_owner_product_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.catalog_status is distinct from old.catalog_status and not public.is_catalog_admin() then
    raise exception using errcode = '42501', message = 'Only marketplace administrators can change product status';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_owner_store_status_change() from public;
revoke all on function public.prevent_owner_product_status_change() from public;
grant execute on function public.prevent_owner_store_status_change() to authenticated;
grant execute on function public.prevent_owner_product_status_change() to authenticated;
create trigger guard_store_status_before_update before update on public.stores
  for each row execute function public.prevent_owner_store_status_change();
create trigger guard_product_status_before_update before update on public.marketplace_products
  for each row execute function public.prevent_owner_product_status_change();

create function public.review_maker_application(application_id uuid, decision text, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  applicant_id uuid;
  application_name text;
  application_description text;
  application_city text;
  application_state char(2);
begin
  if not public.is_catalog_admin() then
    raise exception using errcode = '42501', message = 'Only marketplace administrators can review applications';
  end if;
  if decision not in ('approved', 'rejected') or char_length(coalesce(note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'Invalid review decision';
  end if;

  select user_id, business_name, description, city, state_code
    into applicant_id, application_name, application_description, application_city, application_state
    from public.maker_applications
    where id = application_id and status = 'pending'
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pending application not found';
  end if;

  update public.maker_applications
    set status = decision, response_note = nullif(btrim(note), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = application_id;

  if decision = 'approved' then
    insert into public.user_roles (user_id, role)
      values (applicant_id, 'maker'::public.app_role)
      on conflict (user_id, role) do nothing;
    insert into public.stores (owner_user_id, name, slug, description, city, state_code, status)
      values (applicant_id, application_name, 'maker-' || replace(application_id::text, '-', ''), application_description, application_city, application_state, 'pending')
      on conflict (owner_user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.review_maker_application(uuid, text, text) from public;
grant execute on function public.review_maker_application(uuid, text, text) to authenticated;
