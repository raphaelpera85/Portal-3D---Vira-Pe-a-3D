begin;
select plan(3);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('12000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'digital-buyer-test@example.com', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('12000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'digital-maker-test@example.com', '{"provider":"email","providers":["email"]}', '{}', now(), now());
insert into public.user_roles (user_id, role) values
  ('12000000-0000-4000-8000-000000000001', 'buyer'),
  ('12000000-0000-4000-8000-000000000002', 'maker');
insert into public.product_categories (id, name, slug)
values ('22000000-0000-4000-8000-000000000001', 'Arquivos digitais de teste', 'arquivos-digitais-teste');
insert into public.stores (id, owner_user_id, name, slug, status)
values ('22000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', 'Loja digital de teste', 'loja-digital-teste', 'published');
insert into public.marketplace_products (
  id, store_id, category_id, name, slug, listing_type, fulfillment_mode, price_mode, price_brl,
  catalog_status, published_at, created_by
) values (
  '22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002',
  '22000000-0000-4000-8000-000000000001', 'Arquivo 3MF de teste', 'arquivo-3mf-teste',
  'digital', 'digital', 'fixed', 19.90, 'published', now(), '12000000-0000-4000-8000-000000000002'
);
insert into public.digital_assets (
  product_id, store_id, object_path, file_name, file_bytes, personal_price_brl
) values (
  '22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002',
  '22000000-0000-4000-8000-000000000002/22000000-0000-4000-8000-000000000003/33000000-0000-4000-8000-000000000001.3mf',
  'Arquivo de teste.3mf', 1, 19.90
);

set local role authenticated;
set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000001';
select is(
  public.request_digital_asset_purchase('22000000-0000-4000-8000-000000000003', 'personal'),
  public.request_digital_asset_purchase('22000000-0000-4000-8000-000000000003', 'personal'),
  'returns the same purchase request for a repeated active intent'
);
select is(
  (select count(*)::integer from public.product_quote_requests
    where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003'
      and request_type = 'purchase' and license_type = 'personal'),
  1,
  'creates only one accepted request for duplicate submissions'
);

reset role;
update public.digital_assets set personal_price_brl = 24.90
where product_id = '22000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000001';
select public.request_digital_asset_purchase('22000000-0000-4000-8000-000000000003', 'personal');
select is(
  (select unit_price_brl from public.product_quote_requests
    where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003'
      and request_type = 'purchase' and license_type = 'personal'),
  24.90::numeric,
  'refreshes reused request price after buyer confirms current listing again'
);

reset role;
select * from finish();
rollback;
