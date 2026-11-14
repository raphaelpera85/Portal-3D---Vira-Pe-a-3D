begin;
select plan(11);

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
update public.store_notification_contacts set email = 'digital-maker-test@example.com',
  whatsapp = '+5511999999999', whatsapp_opt_in = true, whatsapp_opt_in_at = now()
where store_id = '22000000-0000-4000-8000-000000000002';
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
select is(
  (select count(*)::integer from public.store_notification_deliveries where request_id =
    (select id from public.product_quote_requests where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003' and request_type = 'purchase' and license_type = 'personal')),
  2,
  'queues one email and one opted-in WhatsApp notification for the single request'
);

reset role;
update public.digital_assets set personal_price_brl = 24.90
where product_id = '22000000-0000-4000-8000-000000000003';
insert into public.store_payment_connections (
  store_id, provider_user_id, access_token_ciphertext, refresh_token_ciphertext, token_expires_at
) values (
  '22000000-0000-4000-8000-000000000002', 'digital-maker-payment-test', 'test-access-ciphertext',
  'test-refresh-ciphertext', now() + interval '1 hour'
);
set local role service_role;
set local request.jwt.claim.role = 'service_role';
select throws_ok(
  $$select * from public.create_product_purchase_payment(
    (select id from public.product_quote_requests where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003' and request_type = 'purchase' and license_type = 'personal'),
    '12000000-0000-4000-8000-000000000001', 199)$$,
  '22023',
  'Digital asset price has changed',
  'rejects checkout with a stale license price'
);
reset role;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000001';
select is(
  public.request_digital_asset_purchase('22000000-0000-4000-8000-000000000003', 'personal'),
  (select id from public.product_quote_requests
    where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003'
      and request_type = 'purchase' and license_type = 'personal'),
  'reuses the same request after the buyer confirms the updated price'
);
select is(
  (select unit_price_brl from public.product_quote_requests
    where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003'
      and request_type = 'purchase' and license_type = 'personal'),
  24.90::numeric,
  'refreshes reused request price after buyer confirms current listing again'
);

reset role;
set local role service_role;
set local request.jwt.claim.role = 'service_role';
select is(
  (select payment_total_cents from public.create_product_purchase_payment(
    (select id from public.product_quote_requests where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003' and request_type = 'purchase' and license_type = 'personal'),
    '12000000-0000-4000-8000-000000000001', 249)),
  2490::bigint,
  'creates payment at current digital license price'
);
select is(
  (select count(*)::integer from public.seller_order_payment_stock_reservations),
  0,
  'does not reserve physical stock for a digital purchase'
);
select is(
  (select payment_id from public.create_product_purchase_payment(
    (select id from public.product_quote_requests where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003' and request_type = 'purchase' and license_type = 'personal'),
    '12000000-0000-4000-8000-000000000001', 249)),
  (select id from public.seller_order_payments where purchase_request_id =
    (select id from public.product_quote_requests where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003' and request_type = 'purchase' and license_type = 'personal')),
  'returns the existing payment when checkout is repeated'
);

reset role;
update public.digital_assets set personal_price_brl = 29.90
where product_id = '22000000-0000-4000-8000-000000000003';
set local role service_role;
set local request.jwt.claim.role = 'service_role';
select is(
  (select payment_total_cents from public.create_product_purchase_payment(
    (select id from public.product_quote_requests where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003' and request_type = 'purchase' and license_type = 'personal'),
    '12000000-0000-4000-8000-000000000001', 249)),
  2490::bigint,
  'keeps an existing active checkout at its confirmed price after listing price changes'
);
reset role;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000001';
select public.request_digital_asset_purchase('22000000-0000-4000-8000-000000000003', 'personal');
select is(
  (select unit_price_brl from public.product_quote_requests
    where buyer_id = '12000000-0000-4000-8000-000000000001'
      and product_id = '22000000-0000-4000-8000-000000000003'
      and request_type = 'purchase' and license_type = 'personal'),
  24.90::numeric,
  'does not change the confirmed price while checkout remains active'
);

reset role;
select * from finish();
rollback;
