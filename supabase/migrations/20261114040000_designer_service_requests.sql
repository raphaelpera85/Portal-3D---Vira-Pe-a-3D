create table public.designer_service_requests (
  id uuid primary key default gen_random_uuid(),
  designer_profile_id uuid not null references public.designer_profiles (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  brief text not null check (char_length(btrim(brief)) between 30 and 2000),
  due_date date,
  reference_url text check (reference_url is null or (reference_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' and char_length(reference_url) <= 1000)),
  status text not null default 'pending' check (status in ('pending', 'quoted')),
  quote_amount_cents bigint check (quote_amount_cents between 1 and 100000000000),
  quote_lead_days smallint check (quote_lead_days between 1 and 365),
  quote_notes text check (quote_notes is null or char_length(btrim(quote_notes)) between 20 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending' and quote_amount_cents is null and quote_lead_days is null and quote_notes is null)
    or (status = 'quoted' and quote_amount_cents is not null and quote_lead_days is not null and quote_notes is not null))
);

create index designer_service_requests_buyer_recent on public.designer_service_requests (buyer_id, created_at desc);
create index designer_service_requests_designer_recent on public.designer_service_requests (designer_profile_id, status, created_at desc);
alter table public.designer_service_requests enable row level security;
revoke all on public.designer_service_requests from anon, authenticated;
grant select on public.designer_service_requests to authenticated;
create policy "Buyers and assigned designers can read service requests" on public.designer_service_requests for select to authenticated
  using (buyer_id = (select auth.uid()) or exists (
    select 1 from public.designer_profiles d where d.id = designer_profile_id and d.user_id = (select auth.uid())
  ) or (select public.is_catalog_admin()));

create function public.create_designer_service_request(
  p_designer_slug text, p_title text, p_brief text, p_due_date date, p_reference_url text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  profile_row public.designer_profiles%rowtype;
  request_id uuid;
begin
  if actor_id is null or not exists (
      select 1 from public.user_roles r where r.user_id = actor_id and r.role = 'buyer'::public.app_role
    ) or p_title is null or char_length(btrim(p_title)) not between 3 and 120
    or p_brief is null or char_length(btrim(p_brief)) not between 30 and 2000
    or (p_due_date is not null and p_due_date < (now() at time zone 'America/Sao_Paulo')::date)
    or (p_reference_url is not null and (p_reference_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' or char_length(p_reference_url) > 1000)) then
    raise exception using errcode = '22023', message = 'Invalid designer service request';
  end if;

  select d.* into profile_row from public.designer_profiles d
    where d.slug = p_designer_slug and d.status = 'published' for share;
  if not found or profile_row.user_id = actor_id then
    raise exception using errcode = '42501', message = 'DESIGNER_UNAVAILABLE';
  end if;

  insert into public.designer_service_requests (designer_profile_id, buyer_id, title, brief, due_date, reference_url)
    values (profile_row.id, actor_id, btrim(p_title), btrim(p_brief), p_due_date, nullif(btrim(p_reference_url), ''))
    returning id into request_id;
  return request_id;
end;
$$;

create function public.submit_designer_service_quote(
  p_request_id uuid, p_amount_cents bigint, p_lead_days smallint, p_notes text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.designer_service_requests%rowtype;
begin
  if actor_id is null or not exists (
      select 1 from public.user_roles r where r.user_id = actor_id and r.role = 'designer'::public.app_role
    ) or p_amount_cents not between 1 and 100000000000 or p_lead_days not between 1 and 365
    or p_notes is null or char_length(btrim(p_notes)) not between 20 and 2000 then
    raise exception using errcode = '22023', message = 'Invalid designer service quote';
  end if;

  select q.* into request_row from public.designer_service_requests q
    join public.designer_profiles d on d.id = q.designer_profile_id
    where q.id = p_request_id and q.status = 'pending' and d.user_id = actor_id
      and d.status = 'published' and q.buyer_id <> actor_id
    for update of q;
  if not found then raise exception using errcode = '42501', message = 'Designer service request unavailable'; end if;

  update public.designer_service_requests set status = 'quoted', quote_amount_cents = p_amount_cents,
    quote_lead_days = p_lead_days, quote_notes = btrim(p_notes), updated_at = now()
    where id = request_row.id;
end;
$$;

revoke all on function public.create_designer_service_request(text, text, text, date, text),
  public.submit_designer_service_quote(uuid, bigint, smallint, text) from public, anon, authenticated;
grant execute on function public.create_designer_service_request(text, text, text, date, text),
  public.submit_designer_service_quote(uuid, bigint, smallint, text) to authenticated;
