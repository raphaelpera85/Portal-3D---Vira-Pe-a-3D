create table public.catalog_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null check (char_length(btrim(manufacturer)) between 2 and 100),
  product_title text not null check (char_length(btrim(product_title)) between 2 and 120),
  product_type text not null check (char_length(btrim(product_type)) between 1 and 120),
  source_url text not null unique check (source_url like 'https://store.anycubic.com/products/%' and char_length(source_url) <= 2048),
  status text not null default 'pending' check (status in ('pending', 'imported', 'dismissed')),
  first_seen_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  printer_model_id uuid references public.printer_models (id) on delete restrict,
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and printer_model_id is null)
    or (status = 'imported' and reviewed_at is not null and printer_model_id is not null)
    or (status = 'dismissed' and reviewed_at is not null and printer_model_id is null)
  )
);

create index catalog_discovery_candidates_pending on public.catalog_discovery_candidates (first_seen_at desc) where status = 'pending';

alter table public.catalog_discovery_candidates enable row level security;
revoke all on public.catalog_discovery_candidates from anon, authenticated;
grant select, update on public.catalog_discovery_candidates to authenticated;
grant select, insert, update on public.catalog_discovery_candidates to service_role;

create policy "Catalog admins read discovered candidates"
  on public.catalog_discovery_candidates for select to authenticated
  using ((select public.is_catalog_admin()));
create policy "Catalog admins review discovered candidates"
  on public.catalog_discovery_candidates for update to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

create function public.review_catalog_discovery_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_model text default '',
  p_variant text default 'standard',
  p_technology text default ''
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  candidate public.catalog_discovery_candidates%rowtype;
  model_id uuid;
begin
  if actor_id is null or not (select public.is_catalog_admin()) then
    raise exception using errcode = '42501', message = 'Catalog administrator required';
  end if;
  if p_decision is null or p_decision not in ('import', 'dismiss') then
    raise exception using errcode = '22023', message = 'Invalid candidate decision';
  end if;

  select * into candidate from public.catalog_discovery_candidates
    where id = p_candidate_id and status = 'pending' for update;
  if not found then raise exception using errcode = '22023', message = 'Candidate is no longer pending'; end if;

  if p_decision = 'dismiss' then
    update public.catalog_discovery_candidates set status = 'dismissed', reviewed_by = actor_id, reviewed_at = now()
      where id = candidate.id;
    return null;
  end if;
  if char_length(btrim(coalesce(p_model, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_variant, ''))) not between 1 and 80
    or coalesce(p_technology, '') not in ('FDM', 'SLA', 'MSLA', 'DLP') then
    raise exception using errcode = '22023', message = 'Invalid printer model fields';
  end if;

  select id into model_id from public.printer_models
    where lower(btrim(manufacturer)) = lower(btrim(candidate.manufacturer))
      and lower(btrim(model)) = lower(btrim(p_model))
      and lower(btrim(variant)) = lower(btrim(p_variant))
    order by created_at limit 1 for update;
  if model_id is null then
    insert into public.printer_models (manufacturer, model, variant, technology, catalog_status, source_url, created_by)
      values (candidate.manufacturer, btrim(p_model), btrim(p_variant), p_technology, 'draft', candidate.source_url, actor_id)
      returning id into model_id;
  end if;
  update public.catalog_discovery_candidates set status = 'imported', reviewed_by = actor_id, reviewed_at = now(), printer_model_id = model_id
    where id = candidate.id;
  return model_id;
end;
$$;

revoke all on function public.review_catalog_discovery_candidate(uuid, text, text, text, text) from public, anon;
grant execute on function public.review_catalog_discovery_candidate(uuid, text, text, text, text) to authenticated;
