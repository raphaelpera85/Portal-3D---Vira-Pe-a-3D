create table public.buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 2 and 40),
  recipient_name text not null check (char_length(btrim(recipient_name)) between 2 and 100),
  postal_code text not null check (postal_code ~ '^\d{8}$'),
  street text not null check (char_length(btrim(street)) between 2 and 120),
  number text not null check (char_length(btrim(number)) between 1 and 20),
  complement text not null default '' check (char_length(complement) <= 100),
  district text not null check (char_length(btrim(district)) between 2 and 100),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  reference text not null default '' check (char_length(reference) <= 200),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index buyer_addresses_single_default on public.buyer_addresses (buyer_id) where is_default;
create index buyer_addresses_recent on public.buyer_addresses (buyer_id, is_default desc, created_at desc);

alter table public.buyer_addresses enable row level security;
revoke all on public.buyer_addresses from anon, authenticated;
grant select on public.buyer_addresses to authenticated;

create policy "Buyers read their own addresses"
  on public.buyer_addresses for select to authenticated
  using (
    buyer_id = (select auth.uid())
    and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'buyer'::public.app_role)
  );

create function public.save_buyer_address(
  p_id uuid, p_label text, p_recipient_name text, p_postal_code text, p_street text,
  p_number text, p_complement text, p_district text, p_city text, p_state_code text,
  p_reference text, p_is_default boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_id uuid;
  make_default boolean;
begin
  if current_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = current_user_id and r.role = 'buyer'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;
  if char_length(btrim(coalesce(p_label, ''))) not between 2 and 40
    or char_length(btrim(coalesce(p_recipient_name, ''))) not between 2 and 100
    or coalesce(p_postal_code, '') !~ '^\d{8}$'
    or char_length(btrim(coalesce(p_street, ''))) not between 2 and 120
    or char_length(btrim(coalesce(p_number, ''))) not between 1 and 20
    or char_length(coalesce(p_complement, '')) > 100
    or char_length(btrim(coalesce(p_district, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_city, ''))) not between 2 and 100
    or coalesce(p_state_code, '') !~ '^[A-Z]{2}$'
    or char_length(coalesce(p_reference, '')) > 200 then
    raise exception using errcode = '22023', message = 'Invalid address';
  end if;

  perform 1 from auth.users u where u.id = current_user_id for update;
  if p_id is not null then
    select a.id into saved_id from public.buyer_addresses a where a.id = p_id and a.buyer_id = current_user_id for update;
    if not found then raise exception using errcode = '42501', message = 'Address not found'; end if;
  end if;

  make_default := coalesce(p_is_default, false) or not exists (
    select 1 from public.buyer_addresses a where a.buyer_id = current_user_id and a.is_default and a.id is distinct from p_id
  );
  if make_default then update public.buyer_addresses set is_default = false where buyer_id = current_user_id and is_default; end if;

  if p_id is null then
    insert into public.buyer_addresses (buyer_id, label, recipient_name, postal_code, street, number, complement, district, city, state_code, reference, is_default)
      values (current_user_id, btrim(p_label), btrim(p_recipient_name), p_postal_code, btrim(p_street), btrim(p_number), btrim(coalesce(p_complement, '')), btrim(p_district), btrim(p_city), p_state_code, btrim(coalesce(p_reference, '')), make_default)
      returning id into saved_id;
  else
    update public.buyer_addresses set label = btrim(p_label), recipient_name = btrim(p_recipient_name), postal_code = p_postal_code,
      street = btrim(p_street), number = btrim(p_number), complement = btrim(coalesce(p_complement, '')),
      district = btrim(p_district), city = btrim(p_city), state_code = p_state_code,
      reference = btrim(coalesce(p_reference, '')), is_default = make_default, updated_at = now()
      where id = p_id and buyer_id = current_user_id;
  end if;
  return saved_id;
end;
$$;

create function public.delete_buyer_address(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  deleted_default boolean;
  next_default uuid;
begin
  if current_user_id is null or not exists (
    select 1 from public.user_roles r where r.user_id = current_user_id and r.role = 'buyer'::public.app_role
  ) then
    raise exception using errcode = '42501', message = 'Buyer account required';
  end if;
  perform 1 from auth.users u where u.id = current_user_id for update;
  delete from public.buyer_addresses a where a.id = p_id and a.buyer_id = current_user_id returning a.is_default into deleted_default;
  if not found then raise exception using errcode = '42501', message = 'Address not found'; end if;
  if deleted_default then
    select a.id into next_default from public.buyer_addresses a where a.buyer_id = current_user_id order by a.created_at desc, a.id limit 1;
    if next_default is not null then update public.buyer_addresses set is_default = true, updated_at = now() where id = next_default; end if;
  end if;
end;
$$;

revoke all on function public.save_buyer_address(uuid, text, text, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.delete_buyer_address(uuid) from public, anon, authenticated;
grant execute on function public.save_buyer_address(uuid, text, text, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.delete_buyer_address(uuid) to authenticated;
