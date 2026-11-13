insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 2097152, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  message_id uuid not null references public.support_messages (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200 and file_name !~ '[/\\[:cntrl:]]'),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  created_at timestamptz not null default now(),
  check (left(storage_path, char_length(ticket_id::text) + 1) = ticket_id::text || '/')
);

create index support_attachments_message on public.support_attachments (message_id, created_at);
alter table public.support_attachments enable row level security;
revoke all on public.support_attachments from anon, authenticated;
grant select on public.support_attachments to authenticated;

create policy "Ticket participants can read support attachments"
  on public.support_attachments for select to authenticated
  using (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and (
      t.user_id = (select auth.uid())
      or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
    ))
  );

create policy "Ticket participants can upload support attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$'
    and exists (select 1 from public.support_tickets t where t.id::text = (storage.foldername(name))[1] and (
      t.user_id = (select auth.uid())
      or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
    ))
  );

create policy "Ticket participants can read support attachments from storage"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and exists (select 1 from public.support_tickets t where t.id::text = (storage.foldername(name))[1] and (
      t.user_id = (select auth.uid())
      or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
    ))
  );

create policy "Ticket participants can remove unregistered support attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'support-attachments'
    and not exists (select 1 from public.support_attachments a where a.storage_path = name)
    and exists (select 1 from public.support_tickets t where t.id::text = (storage.foldername(name))[1] and (
      t.user_id = (select auth.uid())
      or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role)
    ))
  );

create function public.reply_support_ticket_with_id(p_ticket_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_owner uuid;
  ticket_status text;
  actor_role public.app_role;
  created_message_id uuid;
begin
  if (select auth.uid()) is null or p_ticket_id is null or p_message is null or char_length(btrim(p_message)) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'Invalid support message';
  end if;
  select t.user_id, t.status into ticket_owner, ticket_status from public.support_tickets t where t.id = p_ticket_id for update;
  if not found then raise exception using errcode = '42501', message = 'Support ticket unavailable'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role) then
    actor_role := 'admin'::public.app_role;
  elsif ticket_owner = (select auth.uid()) then
    select r.role into actor_role from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role in ('maker'::public.app_role, 'designer'::public.app_role, 'buyer'::public.app_role)
      order by case r.role when 'maker'::public.app_role then 1 when 'designer'::public.app_role then 2 else 3 end limit 1;
  else
    raise exception using errcode = '42501', message = 'Support ticket unavailable';
  end if;
  if ticket_status = 'closed' or actor_role is null then raise exception using errcode = '22023', message = 'Support ticket is closed'; end if;

  insert into public.support_messages (ticket_id, sender_id, sender_role, body)
    values (p_ticket_id, (select auth.uid()), actor_role, btrim(p_message)) returning id into created_message_id;
  update public.support_tickets set status = case when actor_role = 'admin'::public.app_role then 'waiting_user' else 'open' end, updated_at = now()
    where id = p_ticket_id;
  return created_message_id;
end;
$$;

create function public.register_support_attachments(p_ticket_id uuid, p_message_id uuid, p_attachments jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attachment jsonb;
  attachment_count integer;
  total_bytes bigint := 0;
  actual_size bigint;
  file_name text;
  content_type text;
  storage_path text;
  size_bytes integer;
begin
  if (select auth.uid()) is null or p_ticket_id is null or p_message_id is null or p_attachments is null
    or jsonb_typeof(p_attachments) <> 'array' then
    raise exception using errcode = '22023', message = 'Invalid support attachment manifest';
  end if;
  attachment_count := jsonb_array_length(p_attachments);
  if attachment_count not between 1 and 3 or not exists (
    select 1 from public.support_messages m
    join public.support_tickets t on t.id = m.ticket_id
    where m.id = p_message_id and m.ticket_id = p_ticket_id and m.sender_id = (select auth.uid())
      and (t.user_id = (select auth.uid()) or exists (
        select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::public.app_role
      ))
  ) then
    raise exception using errcode = '42501', message = 'Support attachment is not authorized';
  end if;

  for attachment in select value from jsonb_array_elements(p_attachments)
  loop
    file_name := attachment->>'name';
    content_type := attachment->>'contentType';
    storage_path := attachment->>'path';
    if file_name is null or char_length(file_name) not between 1 and 200 or file_name ~ '[/\\[:cntrl:]]'
      or content_type is null or content_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
      or coalesce(attachment->>'size', '') !~ '^[1-9][0-9]{0,6}$'
      or coalesce(storage_path, '') !~ ('^' || p_ticket_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(pdf|jpg|jpeg|png|webp)$') then
      raise exception using errcode = '22023', message = 'Invalid support attachment';
    end if;
    size_bytes := (attachment->>'size')::integer;
    if size_bytes > 2097152 then raise exception using errcode = '22023', message = 'Support attachment too large'; end if;
    select (o.metadata->>'size')::bigint into actual_size from storage.objects o
      where o.bucket_id = 'support-attachments' and o.name = storage_path;
    if actual_size is distinct from size_bytes::bigint then
      raise exception using errcode = '22023', message = 'Support attachment upload is missing or incomplete';
    end if;
    total_bytes := total_bytes + size_bytes;
  end loop;
  if total_bytes > 4194304 then raise exception using errcode = '22023', message = 'Support attachments too large'; end if;

  for attachment in select value from jsonb_array_elements(p_attachments)
  loop
    insert into public.support_attachments (ticket_id, message_id, uploaded_by, storage_path, file_name, content_type, size_bytes)
      values (p_ticket_id, p_message_id, (select auth.uid()), attachment->>'path', attachment->>'name', attachment->>'contentType', (attachment->>'size')::integer);
  end loop;
end;
$$;

revoke all on function public.reply_support_ticket_with_id(uuid, text), public.register_support_attachments(uuid, uuid, jsonb) from public, anon;
grant execute on function public.reply_support_ticket_with_id(uuid, text), public.register_support_attachments(uuid, uuid, jsonb) to authenticated;
