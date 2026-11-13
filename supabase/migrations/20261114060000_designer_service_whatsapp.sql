create or replace function public.enqueue_designer_service_request_email()
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
      from public.store_notification_contacts c where c.store_id = designer_store_id
  on conflict (designer_service_request_id, channel) where designer_service_request_id is not null do nothing;

  insert into public.store_notification_deliveries (designer_service_request_id, channel, destination, payload)
    select new.id, 'whatsapp', c.whatsapp, message_data
      from public.store_notification_contacts c
      where c.store_id = designer_store_id and c.whatsapp is not null and c.whatsapp_opt_in
  on conflict (designer_service_request_id, channel) where designer_service_request_id is not null do nothing;
  return new;
end;
$$;
