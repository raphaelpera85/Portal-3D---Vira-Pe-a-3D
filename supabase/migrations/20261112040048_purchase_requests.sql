alter table public.product_quote_requests
  add column request_type text not null default 'quote' check (request_type in ('quote', 'purchase')),
  add column unit_price_brl numeric(12, 2),
  add constraint product_requests_price_snapshot_check check (
    (request_type = 'quote' and unit_price_brl is null)
    or (request_type = 'purchase' and unit_price_brl is not null and unit_price_brl > 0)
  );

drop policy "Buyers can request quotes for published quote products" on public.product_quote_requests;
create policy "Buyers can request published products"
  on public.product_quote_requests for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and status = 'pending'
    and maker_read_at is null
    and (due_date is null or due_date >= current_date)
    and exists (
      select 1 from public.marketplace_products p
      join public.stores s on s.id = p.store_id
      where p.id = product_quote_requests.product_id and p.store_id = product_quote_requests.store_id
        and p.catalog_status = 'published' and s.status = 'published'
        and product_quote_requests.product_name = p.name and product_quote_requests.store_name = s.name
        and (
          (product_quote_requests.request_type = 'quote' and p.price_mode in ('quote', 'from') and product_quote_requests.unit_price_brl is null)
          or (product_quote_requests.request_type = 'purchase' and p.price_mode = 'fixed' and product_quote_requests.unit_price_brl = p.price_brl)
        )
    )
  );

create or replace function public.submit_product_quote_offer(p_request_id uuid, p_total_brl numeric, p_lead_days smallint, p_terms text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_store uuid;
  request_status text;
  inserted_offer uuid;
begin
  if (select auth.uid()) is null or p_total_brl <= 0 or p_total_brl > 1000000000 or p_lead_days < 1 or p_lead_days > 365 or char_length(coalesce(p_terms, '')) > 2000 then
    raise exception using errcode = '22023', message = 'Invalid quote offer';
  end if;

  select q.store_id, q.status into request_store, request_status
    from public.product_quote_requests q
    join public.stores s on s.id = q.store_id
    where q.id = p_request_id and q.request_type = 'quote'
      and s.owner_user_id = (select auth.uid()) and s.status = 'published'
      and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    for update of q;
  if not found or request_status <> 'pending' then
    raise exception using errcode = '42501', message = 'Quote request is not available to this maker';
  end if;

  insert into public.product_quote_offers (request_id, maker_id, total_brl, lead_days, terms)
    values (p_request_id, (select auth.uid()), p_total_brl, p_lead_days, coalesce(p_terms, ''))
    returning id into inserted_offer;
  update public.product_quote_requests set status = 'offered', updated_at = now() where id = p_request_id;
  return inserted_offer;
end;
$$;

create function public.respond_to_product_purchase_request(p_request_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if (select auth.uid()) is null or p_response is null or p_response not in ('accept', 'decline') then
    raise exception using errcode = '22023', message = 'Invalid purchase response';
  end if;

  select q.status into current_status
    from public.product_quote_requests q
    join public.stores s on s.id = q.store_id
    where q.id = p_request_id and q.request_type = 'purchase'
      and s.owner_user_id = (select auth.uid())
      and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    for update of q;
  if not found or current_status <> 'pending' then
    raise exception using errcode = '42501', message = 'Purchase request is not available to this maker';
  end if;

  update public.product_quote_requests
    set status = case when p_response = 'accept' then 'accepted' else 'declined' end, updated_at = now()
    where id = p_request_id;
end;
$$;

revoke all on function public.respond_to_product_purchase_request(uuid, text) from public;
grant execute on function public.respond_to_product_purchase_request(uuid, text) to authenticated;

create or replace function public.enqueue_quote_request_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_data jsonb := jsonb_build_object('request_type', new.request_type, 'product_name', new.product_name, 'quantity', new.quantity);
begin
  insert into public.store_notification_deliveries (request_id, channel, destination, payload)
    select new.id, 'email', c.email, message_data
      from public.store_notification_contacts c where c.store_id = new.store_id
    union all
    select new.id, 'whatsapp', c.whatsapp, message_data
      from public.store_notification_contacts c where c.store_id = new.store_id and c.whatsapp is not null and c.whatsapp_opt_in;
  return new;
end;
$$;

revoke all on function public.enqueue_quote_request_notifications() from public;

create index product_requests_kind_recent on public.product_quote_requests (request_type, created_at desc);
