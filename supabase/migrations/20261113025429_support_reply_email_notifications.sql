alter table public.store_notification_deliveries
  add column support_message_id uuid references public.support_messages (id) on delete cascade;

alter table public.store_notification_deliveries
  drop constraint store_notification_deliveries_source_check,
  drop constraint store_notification_delivery_parent_check,
  add constraint store_notification_delivery_parent_check
    check (num_nonnulls(request_id, order_id, custom_print_target_id, support_message_id) = 1);

create unique index store_notification_support_message_channel
  on public.store_notification_deliveries (support_message_id, channel)
  where support_message_id is not null;

create function public.enqueue_support_reply_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_email text;
  ticket_subject text;
begin
  if new.sender_role <> 'admin'::public.app_role then
    return new;
  end if;

  select u.email, t.subject into recipient_email, ticket_subject
    from public.support_tickets t
    join auth.users u on u.id = t.user_id
    where t.id = new.ticket_id;

  if recipient_email is not null then
    insert into public.store_notification_deliveries (support_message_id, channel, destination, payload)
      values (new.id, 'email', recipient_email, jsonb_build_object(
        'notification_type', 'support_reply',
        'ticket_subject', left(ticket_subject, 120)
      ));
  end if;

  return new;
end;
$$;

create trigger enqueue_support_reply_email_after_insert
  after insert on public.support_messages
  for each row execute function public.enqueue_support_reply_email();
