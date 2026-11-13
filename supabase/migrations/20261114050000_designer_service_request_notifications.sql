alter table public.store_notification_deliveries
  add column designer_service_request_id uuid references public.designer_service_requests (id) on delete cascade;

alter table public.store_notification_deliveries
  drop constraint store_notification_delivery_parent_check,
  add constraint store_notification_delivery_parent_check
    check (num_nonnulls(request_id, order_id, custom_print_target_id, support_message_id, designer_service_request_id) = 1);

create unique index store_notification_designer_service_channel
  on public.store_notification_deliveries (designer_service_request_id, channel)
  where designer_service_request_id is not null;

create policy "Designers can read delivery status for their service requests"
  on public.store_notification_deliveries for select to authenticated
  using (designer_service_request_id is not null and exists (
    select 1 from public.designer_service_requests q
    join public.designer_profiles d on d.id = q.designer_profile_id
    where q.id = designer_service_request_id and d.user_id = (select auth.uid())
  ));

create function public.enqueue_designer_service_request_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  profile_row public.designer_profiles%rowtype;
  designer_store_id uuid;
  message_data jsonb := jsonb_build_object(
    'notification_type', 'designer_service_request',
    'project_title', left(new.title, 120)
  );
begin
  select d.* into profile_row from public.designer_profiles d where d.id = new.designer_profile_id;
  select s.id into designer_store_id from public.stores s where s.owner_user_id = profile_row.user_id;
  if designer_store_id is null then return new; end if;

  insert into public.store_notification_deliveries (designer_service_request_id, channel, destination, payload)
    select new.id, 'email', c.email, message_data
      from public.store_notification_contacts c where c.store_id = designer_store_id;
  return new;
end;
$$;

revoke all on function public.enqueue_designer_service_request_email() from public, anon, authenticated;
create trigger enqueue_designer_service_request_email_after_insert
  after insert on public.designer_service_requests
  for each row execute function public.enqueue_designer_service_request_email();
