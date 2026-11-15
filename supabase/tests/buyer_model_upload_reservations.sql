begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('13000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'buyer-upload-test@example.invalid', '{}', '{}', now(), now()),
  ('13000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'not-buyer-upload-test@example.invalid', '{}', '{}', now(), now());
insert into public.user_roles (user_id, role) values ('13000000-0000-4000-8000-000000000001', 'buyer');

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '13000000-0000-4000-8000-000000000001';

select public.reserve_buyer_model_upload('13000000-0000-4000-8000-000000000101', 'modelo.3mf', 1000, '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]');
select public.reserve_buyer_model_upload('13000000-0000-4000-8000-000000000102', 'modelo.3mf', 1000, '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]');
select public.reserve_buyer_model_upload('13000000-0000-4000-8000-000000000103', 'modelo.3mf', 1000, '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]');
select public.reserve_buyer_model_upload('13000000-0000-4000-8000-000000000104', 'modelo.3mf', 1000, '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]');
select public.reserve_buyer_model_upload('13000000-0000-4000-8000-000000000105', 'modelo.3mf', 1000, '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]');
select public.release_buyer_model_upload_reservation('13000000-0000-4000-8000-000000000101');

do $$
begin
  begin
    perform public.reserve_buyer_model_upload('13000000-0000-4000-8000-000000000106', 'modelo.3mf', 1000, '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]');
    raise exception 'Expected the sixth reservation to be rejected';
  exception when sqlstate '22023' then null;
  end;
end;
$$;

set local request.jwt.claim.sub = '13000000-0000-4000-8000-000000000002';
do $$
begin
  begin
    perform public.reserve_buyer_model_upload('13000000-0000-4000-8000-000000000201', 'modelo.3mf', 1000, '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]');
    raise exception 'Expected a non-buyer to be rejected';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

rollback;
