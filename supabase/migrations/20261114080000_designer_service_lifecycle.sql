alter table public.designer_service_requests
  add column work_started_at timestamptz,
  add column work_completed_at timestamptz,
  drop constraint designer_service_requests_status_check,
  drop constraint designer_service_requests_quote_state_check,
  add constraint designer_service_requests_status_check
    check (status in ('pending', 'quoted', 'accepted', 'paid', 'in_progress', 'completed')),
  add constraint designer_service_requests_quote_state_check check (
    (status = 'pending' and quote_amount_cents is null and quote_lead_days is null and quote_notes is null)
    or (status in ('quoted', 'accepted', 'paid', 'in_progress', 'completed')
      and quote_amount_cents is not null and quote_lead_days is not null and quote_notes is not null)
  ),
  add constraint designer_service_requests_work_state_check check (
    (status in ('pending', 'quoted', 'accepted', 'paid') and work_started_at is null and work_completed_at is null)
    or (status = 'in_progress' and work_started_at is not null and work_completed_at is null)
    or (status = 'completed' and work_started_at is not null and work_completed_at is not null)
  );

create function public.advance_designer_service_work(p_request_id uuid, p_next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.designer_service_requests%rowtype;
  payment_status text;
begin
  if actor_id is null or p_request_id is null or p_next_status is null or p_next_status not in ('in_progress', 'completed')
    or not exists (select 1 from public.user_roles r where r.user_id = actor_id and r.role = 'designer'::public.app_role) then
    raise exception using errcode = '42501', message = 'Invalid designer service transition';
  end if;

  select q.* into request_row from public.designer_service_requests q
    join public.designer_profiles d on d.id = q.designer_profile_id
    where q.id = p_request_id and d.user_id = actor_id for update of q;
  if not found then raise exception using errcode = '42501', message = 'Designer service request unavailable'; end if;

  if not ((request_row.status = 'paid' and p_next_status = 'in_progress')
    or (request_row.status = 'in_progress' and p_next_status = 'completed')) then
    raise exception using errcode = '22023', message = 'Designer service transition is invalid';
  end if;

  select p.status into payment_status from public.seller_order_payments p
    where p.designer_service_request_id = p_request_id order by p.created_at desc limit 1 for update;
  if payment_status is distinct from 'paid' then
    raise exception using errcode = '22023', message = 'Designer service payment is not settled';
  end if;

  update public.designer_service_requests set status = p_next_status,
    work_started_at = case when p_next_status = 'in_progress' then now() else work_started_at end,
    work_completed_at = case when p_next_status = 'completed' then now() else work_completed_at end,
    updated_at = now()
    where id = p_request_id;
end;
$$;

revoke all on function public.advance_designer_service_work(uuid, text) from public, anon;
grant execute on function public.advance_designer_service_work(uuid, text) to authenticated;
