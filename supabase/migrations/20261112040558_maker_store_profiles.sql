alter table public.stores add column commercial_policies text not null default ''
  check (char_length(commercial_policies) <= 2000);

create function public.save_maker_store_profile(p_description text, p_logo_url text, p_banner_url text,
  p_city text, p_state_code text, p_commercial_policies text)
returns text language plpgsql security definer set search_path = '' as $$
declare store_row public.stores%rowtype;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role)
    or char_length(coalesce(p_description, '')) > 1000
    or char_length(coalesce(p_city, '')) > 80
    or (p_state_code is not null and p_state_code !~ '^[A-Z]{2}$')
    or char_length(coalesce(p_commercial_policies, '')) > 2000
    or (p_logo_url is not null and (char_length(p_logo_url) > 2048
      or p_logo_url !~ '^https://([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}(:[0-9]{1,5})?(/[^[:space:]]*)?$'))
    or (p_banner_url is not null and (char_length(p_banner_url) > 2048
      or p_banner_url !~ '^https://([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}(:[0-9]{1,5})?(/[^[:space:]]*)?$')) then
    raise exception using errcode = '22023', message = 'Invalid store profile';
  end if;
  select s.* into store_row from public.stores s
    where s.owner_user_id = (select auth.uid()) and s.status in ('pending', 'published') for update;
  if not found then raise exception using errcode = '42501', message = 'Maker store is unavailable'; end if;
  update public.stores set description = btrim(coalesce(p_description, '')),
    logo_url = nullif(btrim(p_logo_url), ''), banner_url = nullif(btrim(p_banner_url), ''),
    city = nullif(btrim(p_city), ''), state_code = nullif(btrim(p_state_code), ''),
    commercial_policies = btrim(coalesce(p_commercial_policies, '')), updated_at = now()
    where id = store_row.id returning slug into store_row.slug;
  return store_row.slug;
end;
$$;
revoke all on function public.save_maker_store_profile(text, text, text, text, text, text) from public, anon;
grant execute on function public.save_maker_store_profile(text, text, text, text, text, text) to authenticated;
