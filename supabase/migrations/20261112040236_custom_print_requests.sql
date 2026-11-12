alter table public.buyer_model_uploads add column dimensions_mm jsonb
  check (dimensions_mm is null or (
    jsonb_typeof(dimensions_mm) = 'object'
    and case when jsonb_typeof(dimensions_mm->'x') = 'number' then (dimensions_mm->>'x')::numeric between 0.01 and 10000 else false end
    and case when jsonb_typeof(dimensions_mm->'y') = 'number' then (dimensions_mm->>'y')::numeric between 0.01 and 10000 else false end
    and case when jsonb_typeof(dimensions_mm->'z') = 'number' then (dimensions_mm->>'z')::numeric between 0.01 and 10000 else false end
  ));

create function public.set_buyer_model_upload_dimensions(p_upload_id uuid, p_dimensions_mm jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role
  ) or p_dimensions_mm is null or jsonb_typeof(p_dimensions_mm) <> 'object'
    or (case when jsonb_typeof(p_dimensions_mm->'x') = 'number' then (p_dimensions_mm->>'x')::numeric not between 0.01 and 10000 else true end)
    or (case when jsonb_typeof(p_dimensions_mm->'y') = 'number' then (p_dimensions_mm->>'y')::numeric not between 0.01 and 10000 else true end)
    or (case when jsonb_typeof(p_dimensions_mm->'z') = 'number' then (p_dimensions_mm->>'z')::numeric not between 0.01 and 10000 else true end) then
    raise exception using errcode = '22023', message = 'Invalid model dimensions';
  end if;
  update public.buyer_model_uploads set dimensions_mm = p_dimensions_mm
    where id = p_upload_id and buyer_id = (select auth.uid());
  if not found then raise exception using errcode = '42501', message = 'Model upload unavailable'; end if;
end;
$$;
revoke all on function public.set_buyer_model_upload_dimensions(uuid, jsonb) from public, anon;
grant execute on function public.set_buyer_model_upload_dimensions(uuid, jsonb) to authenticated;

create table public.custom_print_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  upload_id uuid references public.buyer_model_uploads (id) on delete set null,
  model_name text not null check (char_length(model_name) between 1 and 200),
  dimensions_x_mm numeric(9, 2) not null check (dimensions_x_mm between 0.01 and 10000),
  dimensions_y_mm numeric(9, 2) not null check (dimensions_y_mm between 0.01 and 10000),
  dimensions_z_mm numeric(9, 2) not null check (dimensions_z_mm between 0.01 and 10000),
  scale_percent numeric(6, 2) not null check (scale_percent between 1 and 1000),
  material_id uuid references public.material_catalog (id) on delete set null,
  material_snapshot text not null check (char_length(material_snapshot) between 1 and 320),
  quantity smallint not null check (quantity between 1 and 1000),
  color text not null default '' check (char_length(color) <= 80),
  quality text not null check (quality in ('standard', 'fine', 'fast', 'custom')),
  due_date date check (due_date is null or due_date >= current_date),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'offered', 'accepted', 'in_production', 'completed', 'declined', 'cancelled')),
  winning_store_id uuid references public.stores (id) on delete set null,
  production_started_at timestamptz,
  production_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('accepted', 'in_production', 'completed')) = (winning_store_id is not null)),
  check ((status in ('in_production', 'completed')) = (production_started_at is not null)),
  check ((status = 'completed') = (production_completed_at is not null))
);
create index custom_print_requests_buyer_recent on public.custom_print_requests (buyer_id, created_at desc);

create table public.custom_print_request_targets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_print_requests (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  compatibility text not null check (compatibility in ('compatible', 'conditional')),
  maker_read_at timestamptz,
  status text not null default 'invited' check (status in ('invited', 'offered', 'accepted', 'declined', 'closed')),
  created_at timestamptz not null default now(),
  unique (request_id, store_id),
  unique (id, request_id, store_id)
);
create index custom_print_targets_store_recent on public.custom_print_request_targets (store_id, created_at desc);

create table public.custom_print_offers (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null unique,
  request_id uuid not null,
  store_id uuid not null,
  store_name text not null check (char_length(store_name) between 1 and 120),
  total_brl numeric(12, 2) not null check (total_brl between 0.01 and 1000000000),
  lead_days smallint not null check (lead_days between 1 and 365),
  terms text not null default '' check (char_length(terms) <= 2000),
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (target_id, request_id, store_id) references public.custom_print_request_targets (id, request_id, store_id) on delete cascade,
  unique (request_id, store_id)
);
create index custom_print_offers_request on public.custom_print_offers (request_id, created_at);

create function public.can_view_custom_print_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.custom_print_requests q
    where q.id = p_request_id and (
      q.buyer_id = (select auth.uid())
      or exists (
        select 1 from public.custom_print_request_targets t join public.stores s on s.id = t.store_id
        where t.request_id = q.id and s.owner_user_id = (select auth.uid())
          and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
          and ((q.status in ('pending', 'offered') and t.status in ('invited', 'offered'))
            or (q.status in ('accepted', 'in_production', 'completed') and t.status = 'accepted'))
      )
      or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
    )
  );
$$;
create function public.can_view_custom_print_target(p_target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.custom_print_request_targets t
    join public.custom_print_requests q on q.id = t.request_id
    where t.id = p_target_id and (
      q.buyer_id = (select auth.uid())
      or exists (select 1 from public.stores s where s.id = t.store_id and s.owner_user_id = (select auth.uid())
        and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
        and ((q.status in ('pending', 'offered') and t.status in ('invited', 'offered'))
          or (q.status in ('accepted', 'in_production', 'completed') and t.status = 'accepted')))
      or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
    )
  );
$$;
create function public.can_view_custom_print_offer(p_request_id uuid, p_store_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.custom_print_requests q
    where q.id = p_request_id and (
      q.buyer_id = (select auth.uid())
      or exists (select 1 from public.stores s where s.id = p_store_id and s.owner_user_id = (select auth.uid())
        and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role))
      or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
    )
  );
$$;
revoke all on function public.can_view_custom_print_request(uuid), public.can_view_custom_print_target(uuid), public.can_view_custom_print_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_view_custom_print_request(uuid), public.can_view_custom_print_target(uuid), public.can_view_custom_print_offer(uuid, uuid) to authenticated;

alter table public.custom_print_requests enable row level security;
alter table public.custom_print_request_targets enable row level security;
alter table public.custom_print_offers enable row level security;
revoke all on public.custom_print_requests, public.custom_print_request_targets, public.custom_print_offers from anon, authenticated;
grant select on public.custom_print_requests, public.custom_print_request_targets, public.custom_print_offers to authenticated;
create policy "Buyers and assigned makers read custom print requests" on public.custom_print_requests for select to authenticated
  using (public.can_view_custom_print_request(id));
create policy "Buyers and assigned makers read request targets" on public.custom_print_request_targets for select to authenticated
  using (public.can_view_custom_print_target(id));
create policy "Buyers and assigned makers read custom print offers" on public.custom_print_offers for select to authenticated
  using (public.can_view_custom_print_offer(request_id, store_id));

create function public.create_custom_print_request(
  p_upload_id uuid, p_material_id uuid, p_quantity integer, p_scale_percent numeric,
  p_dimensions_x_mm numeric, p_dimensions_y_mm numeric, p_dimensions_z_mm numeric,
  p_color text, p_quality text, p_due_date date, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  buyer_key uuid := (select auth.uid());
  upload_row public.buyer_model_uploads%rowtype;
  material_row public.material_catalog%rowtype;
  file_entry jsonb;
  storage_object storage.objects%rowtype;
  request_key uuid;
  matched_count integer;
begin
  if buyer_key is null or not exists (select 1 from public.user_roles r where r.user_id = buyer_key and r.role = 'buyer'::public.app_role)
    or p_quantity not between 1 and 1000 or p_scale_percent not between 1 and 1000
    or p_dimensions_x_mm not between 0.01 and 10000 or p_dimensions_y_mm not between 0.01 and 10000
    or p_dimensions_z_mm not between 0.01 and 10000 or coalesce(char_length(p_color), 0) > 80
    or p_quality not in ('standard', 'fine', 'fast', 'custom') or (p_due_date is not null and p_due_date < current_date)
    or coalesce(char_length(p_notes), 0) > 1000 then
    raise exception using errcode = '22023', message = 'Invalid custom print request';
  end if;
  select * into upload_row from public.buyer_model_uploads u where u.id = p_upload_id and u.buyer_id = buyer_key for share;
  if not found then raise exception using errcode = '42501', message = 'Model upload unavailable'; end if;
  if upload_row.dimensions_mm is null
    or p_dimensions_x_mm is distinct from (upload_row.dimensions_mm->>'x')::numeric
    or p_dimensions_y_mm is distinct from (upload_row.dimensions_mm->>'y')::numeric
    or p_dimensions_z_mm is distinct from (upload_row.dimensions_mm->>'z')::numeric then
    raise exception using errcode = '22023', message = 'Saved model dimensions do not match';
  end if;
  for file_entry in select value from jsonb_array_elements(upload_row.files) loop
    select o.* into storage_object from storage.objects o
      where o.bucket_id = 'buyer-models'
        and o.name = buyer_key::text || '/' || upload_row.bundle_id::text || '/' || (file_entry->>'storage_name')
      for share;
    if not found or coalesce((storage_object.metadata->>'size')::bigint, -1) <> (file_entry->>'size')::bigint then
      raise exception using errcode = '22023', message = 'Uploaded model files are incomplete';
    end if;
  end loop;
  select * into material_row from public.material_catalog m where m.id = p_material_id and m.catalog_status = 'published';
  if not found then raise exception using errcode = '22023', message = 'Material unavailable'; end if;

  insert into public.custom_print_requests (
    buyer_id, upload_id, model_name, dimensions_x_mm, dimensions_y_mm, dimensions_z_mm, scale_percent,
    material_id, material_snapshot, quantity, color, quality, due_date, notes
  ) values (
    buyer_key, upload_row.id, upload_row.model_name, p_dimensions_x_mm, p_dimensions_y_mm, p_dimensions_z_mm, p_scale_percent,
    material_row.id, material_row.manufacturer || ' ' || material_row.product || ' · ' || material_row.family,
    p_quantity, btrim(coalesce(p_color, '')), p_quality, p_due_date, btrim(coalesce(p_notes, ''))
  ) returning id into request_key;

  insert into public.custom_print_request_targets (request_id, store_id, compatibility)
    select request_key, s.id, 'conditional'
    from public.stores s
    join public.maker_printers mp on mp.store_id = s.id and mp.operational_status = 'available' and mp.catalog_model_id is not null
    join public.printer_models pm on pm.id = mp.catalog_model_id and pm.catalog_status = 'published'
    join public.printer_material_compatibility mc on mc.printer_id = pm.id and mc.material_id = material_row.id
      and mc.catalog_status = 'published' and mc.compatibility in ('compatible', 'conditional')
    where s.status = 'published'
      and (material_row.process = 'filament' and pm.technology = 'FDM' or material_row.process = 'resin' and pm.technology in ('SLA', 'MSLA', 'DLP'))
      and (material_row.process <> 'filament' or (
        material_row.filament_diameter_mm is not null and pm.filament_diameter_mm = material_row.filament_diameter_mm
        and material_row.nozzle_temperature_min_c is not null and pm.max_nozzle_temperature_c >= material_row.nozzle_temperature_min_c
        and material_row.bed_temperature_min_c is not null and pm.heated_bed is true
        and pm.max_bed_temperature_c >= material_row.bed_temperature_min_c
        and material_row.requires_enclosure is not null and (material_row.requires_enclosure is false or pm.enclosure is true)
        and material_row.abrasive is not null
        and jsonb_typeof(material_row.technical_properties->'nozzleDiametersMm') = 'array'
        and exists (
          select 1 from public.printer_nozzle_compatibility pnc
          join public.nozzle_catalog n on n.id = pnc.nozzle_id and n.catalog_status = 'published'
          where pnc.printer_id = pm.id and pnc.catalog_status = 'published' and pnc.fit = 'compatible'
            and (material_row.abrasive is not true or n.abrasion_resistant is true)
            and n.max_temperature_c is not null and n.max_temperature_c >= material_row.nozzle_temperature_min_c
            and exists (select 1 from jsonb_array_elements(material_row.technical_properties->'nozzleDiametersMm') as diameters(value)
              where diameters.value = to_jsonb(n.diameter_mm))
        )
      ))
      and pm.build_volume_x_mm is not null and pm.build_volume_y_mm is not null and pm.build_volume_z_mm is not null
      and greatest(p_dimensions_x_mm, p_dimensions_y_mm, p_dimensions_z_mm) * p_scale_percent / 100 <= greatest(pm.build_volume_x_mm, pm.build_volume_y_mm, pm.build_volume_z_mm)
      and (p_dimensions_x_mm + p_dimensions_y_mm + p_dimensions_z_mm
        - greatest(p_dimensions_x_mm, p_dimensions_y_mm, p_dimensions_z_mm)
        - least(p_dimensions_x_mm, p_dimensions_y_mm, p_dimensions_z_mm)) * p_scale_percent / 100
        <= pm.build_volume_x_mm + pm.build_volume_y_mm + pm.build_volume_z_mm
          - greatest(pm.build_volume_x_mm, pm.build_volume_y_mm, pm.build_volume_z_mm)
          - least(pm.build_volume_x_mm, pm.build_volume_y_mm, pm.build_volume_z_mm)
      and least(p_dimensions_x_mm, p_dimensions_y_mm, p_dimensions_z_mm) * p_scale_percent / 100 <= least(pm.build_volume_x_mm, pm.build_volume_y_mm, pm.build_volume_z_mm)
    group by s.id;
  get diagnostics matched_count = row_count;
  if matched_count = 0 then raise exception using errcode = 'P0001', message = 'NO_COMPATIBLE_STORES'; end if;
  return request_key;
end;
$$;

create function public.submit_custom_print_offer(p_target_id uuid, p_total_brl numeric, p_lead_days integer, p_terms text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  buyer_request public.custom_print_requests%rowtype;
  target_row public.custom_print_request_targets%rowtype;
  maker_store public.stores%rowtype;
begin
  select * into target_row from public.custom_print_request_targets t where t.id = p_target_id;
  if not found then raise exception using errcode = '42501', message = 'Request unavailable'; end if;
  select * into buyer_request from public.custom_print_requests q where q.id = target_row.request_id for update;
  select * into maker_store from public.stores s where s.id = target_row.store_id and s.owner_user_id = (select auth.uid()) and s.status = 'published';
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or maker_store.id is null or buyer_request.status not in ('pending', 'offered') or target_row.status <> 'invited'
    or p_total_brl not between 0.01 and 1000000000 or p_lead_days not between 1 and 365 or char_length(coalesce(p_terms, '')) > 2000 then
    raise exception using errcode = '22023', message = 'Offer cannot be submitted';
  end if;
  insert into public.custom_print_offers (target_id, request_id, store_id, store_name, total_brl, lead_days, terms)
    values (target_row.id, target_row.request_id, target_row.store_id, maker_store.name, p_total_brl, p_lead_days, btrim(coalesce(p_terms, '')));
  update public.custom_print_request_targets set status = 'offered' where id = target_row.id;
  update public.custom_print_requests set status = 'offered', updated_at = now() where id = buyer_request.id and status = 'pending';
end;
$$;

create function public.respond_to_custom_print_offer(p_offer_id uuid, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  offer_row public.custom_print_offers%rowtype;
  request_row public.custom_print_requests%rowtype;
begin
  select * into offer_row from public.custom_print_offers o where o.id = p_offer_id;
  if not found then raise exception using errcode = '42501', message = 'Offer unavailable'; end if;
  select * into request_row from public.custom_print_requests q where q.id = offer_row.request_id and q.buyer_id = (select auth.uid()) for update;
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    or request_row.id is null or request_row.status <> 'offered' or offer_row.status <> 'offered'
    or p_response is null or p_response not in ('accept', 'decline') then
    raise exception using errcode = '22023', message = 'Offer cannot be answered';
  end if;
  if p_response = 'accept' then
    update public.custom_print_offers set status = case when id = offer_row.id then 'accepted' else 'closed' end, updated_at = now()
      where request_id = request_row.id and status = 'offered';
    update public.custom_print_request_targets set status = case when store_id = offer_row.store_id then 'accepted' else 'closed' end
      where request_id = request_row.id and status in ('invited', 'offered');
    update public.custom_print_requests set status = 'accepted', winning_store_id = offer_row.store_id, updated_at = now() where id = request_row.id;
  else
    update public.custom_print_offers set status = 'declined', updated_at = now() where id = offer_row.id;
    update public.custom_print_request_targets set status = 'declined' where id = offer_row.target_id;
    if not exists (select 1 from public.custom_print_request_targets t where t.request_id = request_row.id and t.status in ('invited', 'offered')) then
      update public.custom_print_requests set status = 'declined', updated_at = now() where id = request_row.id;
    end if;
  end if;
end;
$$;

create function public.cancel_custom_print_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype;
begin
  select * into request_row from public.custom_print_requests q where q.id = p_request_id and q.buyer_id = (select auth.uid()) for update;
  if request_row.id is null or not (
      request_row.status in ('pending', 'offered')
      or (request_row.status = 'accepted' and request_row.production_started_at is null)
    )
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '22023', message = 'Request cannot be cancelled';
  end if;
  update public.custom_print_requests set status = 'cancelled', winning_store_id = null, updated_at = now() where id = request_row.id;
  update public.custom_print_request_targets set status = 'closed' where request_id = request_row.id and status in ('invited', 'offered', 'accepted');
  update public.custom_print_offers set status = 'closed', updated_at = now() where request_id = request_row.id and status in ('offered', 'accepted');
end;
$$;

create function public.advance_custom_print_production(p_request_id uuid, p_next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype;
begin
  select * into request_row from public.custom_print_requests q where q.id = p_request_id for update;
  if request_row.id is null or request_row.winning_store_id is null
    or not exists (select 1 from public.stores s where s.id = request_row.winning_store_id and s.owner_user_id = (select auth.uid()))
    or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or not ((request_row.status = 'accepted' and p_next_status = 'in_production')
      or (request_row.status = 'in_production' and p_next_status = 'completed')) then
    raise exception using errcode = '42501', message = 'Production status cannot be changed';
  end if;
  update public.custom_print_requests set status = p_next_status,
    production_started_at = case when p_next_status = 'in_production' then now() else production_started_at end,
    production_completed_at = case when p_next_status = 'completed' then now() else production_completed_at end,
    updated_at = now() where id = request_row.id;
end;
$$;

create function public.mark_custom_print_target_read(p_target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.custom_print_request_targets t set maker_read_at = now()
  where t.id = p_target_id and t.maker_read_at is null
    and exists (select 1 from public.stores s where s.id = t.store_id and s.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role);
end;
$$;

revoke all on function public.create_custom_print_request(uuid, uuid, integer, numeric, numeric, numeric, numeric, text, text, date, text),
  public.submit_custom_print_offer(uuid, numeric, integer, text), public.respond_to_custom_print_offer(uuid, text),
  public.cancel_custom_print_request(uuid), public.mark_custom_print_target_read(uuid) from public, anon;
grant execute on function public.create_custom_print_request(uuid, uuid, integer, numeric, numeric, numeric, numeric, text, text, date, text),
  public.submit_custom_print_offer(uuid, numeric, integer, text), public.respond_to_custom_print_offer(uuid, text),
  public.cancel_custom_print_request(uuid), public.mark_custom_print_target_read(uuid) to authenticated;
revoke all on function public.advance_custom_print_production(uuid, text) from public, anon;
grant execute on function public.advance_custom_print_production(uuid, text) to authenticated;

alter table public.store_notification_deliveries alter column request_id drop not null;
alter table public.store_notification_deliveries add column custom_print_target_id uuid references public.custom_print_request_targets (id) on delete cascade;
alter table public.store_notification_deliveries add constraint store_notification_deliveries_source_check
  check ((request_id is not null) <> (custom_print_target_id is not null));
create unique index store_notification_custom_print_channel on public.store_notification_deliveries (custom_print_target_id, channel) where custom_print_target_id is not null;
create policy "Makers read custom print notification delivery status" on public.store_notification_deliveries for select to authenticated
  using (custom_print_target_id is not null and public.can_view_custom_print_target(custom_print_target_id)
    and exists (select 1 from public.stores s join public.custom_print_request_targets t on t.store_id = s.id
      where t.id = custom_print_target_id and s.owner_user_id = (select auth.uid())));

create function public.enqueue_custom_print_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare request_row public.custom_print_requests%rowtype; message_data jsonb;
begin
  select * into request_row from public.custom_print_requests q where q.id = new.request_id;
  message_data := jsonb_build_object('request_type', 'quote', 'product_name', 'Impressão personalizada — ' || request_row.model_name,
    'quantity', request_row.quantity, 'custom_print', true);
  insert into public.store_notification_deliveries (custom_print_target_id, channel, destination, payload)
    select new.id, 'email', c.email, message_data from public.store_notification_contacts c where c.store_id = new.store_id
    union all
    select new.id, 'whatsapp', c.whatsapp, message_data from public.store_notification_contacts c
      where c.store_id = new.store_id and c.whatsapp is not null and c.whatsapp_opt_in;
  return new;
end;
$$;
revoke all on function public.enqueue_custom_print_notifications() from public, anon, authenticated;
create trigger enqueue_custom_print_notifications_after_insert after insert on public.custom_print_request_targets
  for each row execute function public.enqueue_custom_print_notifications();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'custom_print_request_targets') then
    alter publication supabase_realtime add table public.custom_print_request_targets;
  end if;
end;
$$;

create function public.retry_custom_print_notification_delivery(p_delivery_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_notification_deliveries d
    join public.custom_print_request_targets t on t.id = d.custom_print_target_id
    join public.stores s on s.id = t.store_id
    where d.id = p_delivery_id and d.status = 'failed' and s.owner_user_id = (select auth.uid())
      and t.status in ('invited', 'offered', 'accepted')
  ) or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role) then
    raise exception using errcode = '42501', message = 'Delivery cannot be retried';
  end if;
  update public.store_notification_deliveries set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
    where id = p_delivery_id and status = 'failed';
end;
$$;
revoke all on function public.retry_custom_print_notification_delivery(uuid) from public, anon;
grant execute on function public.retry_custom_print_notification_delivery(uuid) to authenticated;

create or replace function public.delete_buyer_model_upload(p_upload_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare upload_row public.buyer_model_uploads%rowtype;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Model upload unavailable';
  end if;
  select * into upload_row from public.buyer_model_uploads u where u.id = p_upload_id and u.buyer_id = (select auth.uid()) for update;
  if not found then raise exception using errcode = '42501', message = 'Model upload unavailable'; end if;
  if exists (select 1 from public.custom_print_requests q where q.upload_id = upload_row.id and q.buyer_id = (select auth.uid()) and q.status in ('pending', 'offered', 'accepted', 'in_production')) then
    raise exception using errcode = '42501', message = 'Model upload is attached to an active print request';
  end if;
  delete from public.buyer_model_uploads where id = upload_row.id;
end;
$$;
revoke all on function public.delete_buyer_model_upload(uuid) from public, anon, authenticated;
grant execute on function public.delete_buyer_model_upload(uuid) to authenticated;

drop policy "Buyers can remove their own model files" on storage.objects;
create policy "Buyers can remove unregistered model files" on storage.objects for delete to authenticated
  using (
    bucket_id = 'buyer-models'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
    and not exists (select 1 from public.buyer_model_uploads u
      where u.buyer_id = (select auth.uid()) and u.bundle_id::text = (storage.foldername(name))[2])
  );
