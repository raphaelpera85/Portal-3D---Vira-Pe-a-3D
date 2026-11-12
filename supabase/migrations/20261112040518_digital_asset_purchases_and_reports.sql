alter table public.product_quote_requests
  add column license_type text check (license_type is null or license_type in ('personal', 'commercial'));

drop policy "Buyers can request published products" on public.product_quote_requests;
create policy "Buyers can request published physical products"
  on public.product_quote_requests for insert to authenticated
  with check (
    buyer_id = (select auth.uid()) and status = 'pending' and maker_read_at is null
    and (due_date is null or due_date >= current_date) and license_type is null
    and exists (
      select 1 from public.marketplace_products p join public.stores s on s.id = p.store_id
      where p.id = product_quote_requests.product_id and p.store_id = product_quote_requests.store_id
        and p.catalog_status = 'published' and p.listing_type <> 'digital' and s.status = 'published'
        and product_quote_requests.product_name = p.name and product_quote_requests.store_name = s.name
        and ((product_quote_requests.request_type = 'quote' and p.price_mode in ('quote', 'from') and product_quote_requests.unit_price_brl is null)
          or (product_quote_requests.request_type = 'purchase' and p.price_mode = 'fixed' and product_quote_requests.unit_price_brl = p.price_brl))
    )
  );

create or replace function public.enqueue_quote_request_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare message_data jsonb := jsonb_build_object('request_type', new.request_type, 'product_name', new.product_name,
  'quantity', new.quantity, 'license_type', new.license_type);
begin
  insert into public.store_notification_deliveries (request_id, channel, destination, payload)
    select new.id, 'email', c.email, message_data from public.store_notification_contacts c where c.store_id = new.store_id
    union all
    select new.id, 'whatsapp', c.whatsapp, message_data from public.store_notification_contacts c
      where c.store_id = new.store_id and c.whatsapp is not null and c.whatsapp_opt_in;
  return new;
end;
$$;

create function public.request_digital_asset_purchase(p_product_id uuid, p_license_type text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  product_row record;
  license_price numeric(12, 2);
  request_id uuid;
begin
  if actor_id is null or p_product_id is null or p_license_type is null or p_license_type not in ('personal', 'commercial')
    or not exists (select 1 from public.user_roles r where r.user_id = actor_id and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '22023', message = 'Invalid digital asset purchase';
  end if;
  select p.id, p.store_id, p.name, p.price_brl, s.name as store_name,
    d.personal_price_brl, d.commercial_price_brl
    into product_row from public.marketplace_products p join public.stores s on s.id = p.store_id
    join public.digital_assets d on d.product_id = p.id and d.store_id = p.store_id
    where p.id = p_product_id and p.listing_type = 'digital' and p.fulfillment_mode = 'digital'
      and p.price_mode = 'fixed' and p.catalog_status = 'published' and s.status = 'published';
  if not found then raise exception using errcode = '22023', message = 'Digital asset is not available'; end if;
  license_price := case p_license_type when 'personal' then product_row.personal_price_brl else product_row.commercial_price_brl end;
  if license_price is null or license_price <= 0 or license_price > 1000000 then
    raise exception using errcode = '22023', message = 'Selected license is not available';
  end if;
  insert into public.product_quote_requests (buyer_id, store_id, product_id, store_name, product_name,
    request_type, unit_price_brl, quantity, customization, status, license_type)
  values (actor_id, product_row.store_id, product_row.id, product_row.store_name, product_row.name,
    'purchase', license_price, 1, '', 'accepted', p_license_type)
  returning id into request_id;
  return request_id;
end;
$$;

create table public.digital_asset_downloads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.product_quote_requests (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  license_type text not null check (license_type in ('personal', 'commercial')),
  created_at timestamptz not null default now()
);
create index digital_asset_downloads_buyer_recent on public.digital_asset_downloads (buyer_id, created_at desc);
alter table public.digital_asset_downloads enable row level security;
revoke all on public.digital_asset_downloads from anon, authenticated;
grant select on public.digital_asset_downloads to authenticated;
create policy "Buyers can read their digital download history" on public.digital_asset_downloads for select to authenticated
  using (buyer_id = (select auth.uid()));

create function public.record_digital_asset_download(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_row public.product_quote_requests%rowtype; download_id uuid;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;
  select q.* into request_row from public.product_quote_requests q
    where q.id = p_request_id and q.buyer_id = (select auth.uid()) and q.request_type = 'purchase'
      and q.status = 'accepted' and q.license_type in ('personal', 'commercial')
      and exists (select 1 from public.seller_order_payments pay
        where pay.purchase_request_id = q.id and pay.buyer_id = q.buyer_id and pay.status = 'paid')
      and exists (select 1 from public.digital_assets d where d.product_id = q.product_id);
  if not found then raise exception using errcode = '42501', message = 'Paid digital purchase not found'; end if;
  insert into public.digital_asset_downloads (request_id, buyer_id, license_type)
    values (request_row.id, request_row.buyer_id, request_row.license_type) returning id into download_id;
  return download_id;
end;
$$;

create table public.digital_asset_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products (id) on delete restrict,
  reporter_id uuid not null references auth.users (id) on delete restrict,
  reason text not null check (reason in ('copyright', 'trademark', 'other')),
  details text not null check (char_length(btrim(details)) between 20 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  response_note text check (response_note is null or char_length(response_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'open' and reviewed_by is null and reviewed_at is null)
    or (status <> 'open' and reviewed_by is not null and reviewed_at is not null))
);
create index digital_asset_reports_open_queue on public.digital_asset_reports (created_at) where status = 'open';
alter table public.digital_asset_reports enable row level security;
revoke all on public.digital_asset_reports from anon, authenticated;
grant select, insert on public.digital_asset_reports to authenticated;
create policy "Reporters can read their own digital asset reports" on public.digital_asset_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy "Admins can read digital asset reports" on public.digital_asset_reports for select to authenticated
  using ((select public.is_catalog_admin()));
create policy "Buyers can report a published digital asset" on public.digital_asset_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open' and response_note is null
    and reviewed_by is null and reviewed_at is null
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    and exists (select 1 from public.marketplace_products p where p.id = product_id and p.listing_type = 'digital' and p.catalog_status = 'published'));

create function public.review_digital_asset_report(p_report_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare report_row public.digital_asset_reports%rowtype;
begin
  if not public.is_catalog_admin() or p_decision is null or p_decision not in ('resolved', 'dismissed', 'archived')
    or (p_note is not null and char_length(p_note) > 1000) then
    raise exception using errcode = '42501', message = 'Invalid digital asset report review';
  end if;
  select r.* into report_row from public.digital_asset_reports r where r.id = p_report_id and r.status = 'open' for update;
  if not found then raise exception using errcode = '22023', message = 'Open report not found'; end if;
  update public.digital_asset_reports set status = case when p_decision = 'dismissed' then 'dismissed' else 'resolved' end,
    response_note = nullif(btrim(p_note), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_report_id;
  if p_decision = 'archived' then
    update public.marketplace_products set catalog_status = 'archived', updated_at = now() where id = report_row.product_id and catalog_status = 'published';
  end if;
end;
$$;

revoke all on function public.request_digital_asset_purchase(uuid, text), public.record_digital_asset_download(uuid),
  public.review_digital_asset_report(uuid, text, text) from public, anon;
grant execute on function public.request_digital_asset_purchase(uuid, text), public.record_digital_asset_download(uuid) to authenticated;
grant execute on function public.review_digital_asset_report(uuid, text, text) to authenticated;
