do $$
declare
  buyer_key uuid := gen_random_uuid();
  non_buyer_key uuid := gen_random_uuid();
  bundle_ids uuid[] := array_fill(null::uuid, array[5]);
  index integer;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (buyer_key, 'authenticated', 'authenticated', buyer_key::text || '@buyer-upload-test.invalid', '{}', '{}', now(), now()),
    (non_buyer_key, 'authenticated', 'authenticated', non_buyer_key::text || '@non-buyer-upload-test.invalid', '{}', '{}', now(), now());
  delete from public.user_roles where user_id = non_buyer_key;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', buyer_key::text, true);
  for index in 1..5 loop
    bundle_ids[index] := gen_random_uuid();
    perform public.reserve_buyer_model_upload(
      bundle_ids[index], 'modelo.3mf', 1000,
      '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]'::jsonb
    );
  end loop;
  perform public.release_buyer_model_upload_reservation(bundle_ids[1]);

  begin
    perform public.reserve_buyer_model_upload(
      gen_random_uuid(), 'modelo.3mf', 1000,
      '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]'::jsonb
    );
    raise exception 'Expected the sixth reservation to be rejected';
  exception when sqlstate '22023' then null;
  end;

  perform set_config('request.jwt.claim.sub', non_buyer_key::text, true);
  begin
    perform public.reserve_buyer_model_upload(
      gen_random_uuid(), 'modelo.3mf', 1000,
      '[{"name":"modelo.3mf","storage_name":"modelo.3mf","size":1000}]'::jsonb
    );
    raise exception 'Expected a non-buyer to be rejected';
  exception when sqlstate '42501' then null;
  end;

  delete from public.user_roles where user_id in (buyer_key, non_buyer_key);
  delete from auth.users where id in (buyer_key, non_buyer_key);
end;
$$;
