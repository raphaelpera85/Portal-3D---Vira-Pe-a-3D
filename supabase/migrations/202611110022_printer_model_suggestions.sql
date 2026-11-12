create table public.printer_model_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggested_by uuid not null references auth.users (id) on delete cascade,
  manufacturer text not null check (char_length(btrim(manufacturer)) between 2 and 100),
  model text not null check (char_length(btrim(model)) between 1 and 120),
  variant text not null default 'standard' check (char_length(btrim(variant)) between 1 and 80),
  technology text not null check (technology in ('FDM', 'SLA', 'MSLA', 'DLP')),
  source_url text check (source_url is null or (source_url like 'https://%' and char_length(source_url) <= 2048)),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  printer_model_id uuid references public.printer_models (id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null and printer_model_id is null)
    or (status = 'approved' and reviewed_at is not null and printer_model_id is not null)
    or (status = 'rejected' and reviewed_at is not null and printer_model_id is null))
);

create index printer_model_suggestions_owner_recent on public.printer_model_suggestions (suggested_by, created_at desc);
create index printer_model_suggestions_review_queue on public.printer_model_suggestions (created_at) where status = 'pending';
create unique index printer_model_suggestions_one_pending_model on public.printer_model_suggestions (
  lower(btrim(manufacturer)), lower(btrim(model)), lower(btrim(variant))
) where status = 'pending';

alter table public.printer_model_suggestions enable row level security;
revoke all on public.printer_model_suggestions from anon, authenticated;
grant select on public.printer_model_suggestions to authenticated;
create policy "Makers read their suggestions and admins read all"
  on public.printer_model_suggestions for select to authenticated
  using (
    public.is_catalog_admin()
    or (suggested_by = (select auth.uid()) and exists (
      select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role
    ))
  );

create function public.submit_printer_model_suggestion(
  p_manufacturer text, p_model text, p_variant text, p_technology text, p_source_url text default null, p_notes text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  maker_id uuid := (select auth.uid());
  suggestion_id uuid;
  pending_count integer;
begin
  if maker_id is null
    or not exists (select 1 from public.user_roles r where r.user_id = maker_id and r.role = 'maker'::public.app_role)
    or not exists (select 1 from public.stores s where s.owner_user_id = maker_id)
    or char_length(btrim(coalesce(p_manufacturer, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_model, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_variant, ''))) > 80
    or coalesce(p_technology, '') not in ('FDM', 'SLA', 'MSLA', 'DLP')
    or (p_source_url is not null and (p_source_url not like 'https://%' or char_length(p_source_url) > 2048))
    or char_length(coalesce(p_notes, '')) > 1000 then
    raise exception using errcode = '22023', message = 'Invalid printer model suggestion';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(maker_id::text, 0));
  select count(*) into pending_count from public.printer_model_suggestions s
    where s.suggested_by = maker_id and s.status = 'pending';
  if pending_count >= 5 then raise exception using errcode = 'P0001', message = 'SUGGESTION_PENDING_LIMIT'; end if;
  insert into public.printer_model_suggestions (suggested_by, manufacturer, model, variant, technology, source_url, notes)
    values (maker_id, btrim(p_manufacturer), btrim(p_model), coalesce(nullif(btrim(p_variant), ''), 'standard'),
      p_technology, nullif(btrim(coalesce(p_source_url, '')), ''), btrim(coalesce(p_notes, '')))
    returning id into suggestion_id;
  return suggestion_id;
end;
$$;
revoke all on function public.submit_printer_model_suggestion(text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_printer_model_suggestion(text, text, text, text, text, text) to authenticated;

create function public.review_printer_model_suggestion(p_suggestion_id uuid, p_decision text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  suggestion_row public.printer_model_suggestions%rowtype;
  model_row public.printer_models%rowtype;
begin
  if (select auth.uid()) is null
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
    or p_decision is null or p_decision not in ('approve', 'reject') or char_length(coalesce(p_note, '')) > 1000 then
    raise exception using errcode = '42501', message = 'Suggestion review is not authorized';
  end if;
  select * into suggestion_row from public.printer_model_suggestions s
    where s.id = p_suggestion_id and s.status = 'pending' for update;
  if not found then raise exception using errcode = '22023', message = 'Suggestion is no longer pending'; end if;

  if p_decision = 'approve' then
    select * into model_row from public.printer_models p
      where lower(btrim(p.manufacturer)) = lower(btrim(suggestion_row.manufacturer))
        and lower(btrim(p.model)) = lower(btrim(suggestion_row.model))
        and lower(btrim(p.variant)) = lower(btrim(suggestion_row.variant))
      order by p.created_at limit 1 for update;
    if model_row.id is not null and model_row.technology <> suggestion_row.technology then
      raise exception using errcode = '22023', message = 'Existing model uses a different technology';
    end if;
    if model_row.id is not null and model_row.catalog_status = 'archived' then
      raise exception using errcode = '22023', message = 'Existing model is archived';
    end if;
    if model_row.id is null then
      insert into public.printer_models (manufacturer, model, variant, technology, catalog_status, source_url, created_by)
        values (suggestion_row.manufacturer, suggestion_row.model, suggestion_row.variant, suggestion_row.technology,
          'draft', suggestion_row.source_url, (select auth.uid()))
        on conflict (manufacturer, model, variant) do nothing;
      select * into model_row from public.printer_models p
        where lower(btrim(p.manufacturer)) = lower(btrim(suggestion_row.manufacturer))
          and lower(btrim(p.model)) = lower(btrim(suggestion_row.model))
          and lower(btrim(p.variant)) = lower(btrim(suggestion_row.variant))
        order by p.created_at limit 1;
      if model_row.id is null or model_row.technology <> suggestion_row.technology then
        raise exception using errcode = '22023', message = 'Model could not be added to the catalog';
      end if;
    end if;
    update public.printer_model_suggestions set status = 'approved', printer_model_id = model_row.id,
      review_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
      where id = suggestion_row.id;
  else
    update public.printer_model_suggestions set status = 'rejected',
      review_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
      where id = suggestion_row.id;
  end if;
end;
$$;
revoke all on function public.review_printer_model_suggestion(uuid, text, text) from public, anon;
grant execute on function public.review_printer_model_suggestion(uuid, text, text) to authenticated;
