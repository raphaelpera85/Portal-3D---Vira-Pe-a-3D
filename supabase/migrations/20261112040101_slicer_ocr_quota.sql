create table public.maker_slicer_ocr_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  images_used smallint not null check (images_used between 1 and 30),
  primary key (user_id, usage_date)
);

alter table public.maker_slicer_ocr_daily_usage enable row level security;
revoke all on public.maker_slicer_ocr_daily_usage from public, anon, authenticated;

create function public.consume_maker_slicer_ocr_quota(p_image_count smallint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare used boolean;
begin
  if (select auth.uid()) is null or p_image_count is null or p_image_count not between 1 and 3
     or not exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'maker'::public.app_role) then
    raise exception using errcode = '42501', message = 'Maker account required for OCR';
  end if;

  delete from public.maker_slicer_ocr_daily_usage
    where user_id = (select auth.uid()) and usage_date < (now() at time zone 'utc')::date - 30;
  insert into public.maker_slicer_ocr_daily_usage (user_id, usage_date, images_used)
    values ((select auth.uid()), (now() at time zone 'utc')::date, p_image_count)
    on conflict (user_id, usage_date) do update
      set images_used = public.maker_slicer_ocr_daily_usage.images_used + excluded.images_used
      where public.maker_slicer_ocr_daily_usage.images_used + excluded.images_used <= 30
    returning true into used;
  return coalesce(used, false);
end; $$;

revoke all on function public.consume_maker_slicer_ocr_quota(smallint) from public, anon;
grant execute on function public.consume_maker_slicer_ocr_quota(smallint) to authenticated;
