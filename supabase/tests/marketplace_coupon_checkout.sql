begin;
select plan(12);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'virapeca-checkout-buyer@example.com', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'virapeca-checkout-seller-a@example.com', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'virapeca-checkout-seller-b@example.com', '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.user_roles (user_id, role) values
  ('10000000-0000-4000-8000-000000000010', 'buyer'),
  ('10000000-0000-4000-8000-000000000011', 'maker'),
  ('10000000-0000-4000-8000-000000000012', 'maker')
on conflict (user_id, role) do nothing;

insert into public.stores (id, owner_user_id, name, slug, status) values
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000011', 'Checkout seller A', 'codex-checkout-seller-a', 'published'),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000012', 'Checkout seller B', 'codex-checkout-seller-b', 'published');

insert into public.store_notification_contacts (store_id, email, whatsapp, whatsapp_opt_in, whatsapp_opt_in_at) values
  ('20000000-0000-4000-8000-000000000010', 'checkout-seller-a@example.com', '+5513988112904', true, now()),
  ('20000000-0000-4000-8000-000000000011', 'checkout-seller-b@example.com', null, false, null)
on conflict (store_id) do update set email = excluded.email, whatsapp = excluded.whatsapp,
  whatsapp_opt_in = excluded.whatsapp_opt_in, whatsapp_opt_in_at = excluded.whatsapp_opt_in_at;

insert into public.store_payment_connections (store_id, provider, provider_user_id, access_token_ciphertext,
  refresh_token_ciphertext, token_expires_at, scopes)
values
  ('20000000-0000-4000-8000-000000000010', 'mercado_pago', 'codex-checkout-a', 'test-ciphertext', 'test-ciphertext', now() + interval '1 day', 'read write'),
  ('20000000-0000-4000-8000-000000000011', 'mercado_pago', 'codex-checkout-b', 'test-ciphertext', 'test-ciphertext', now() + interval '1 day', 'read write');

insert into public.marketplace_products (id, store_id, category_id, name, slug, listing_type, fulfillment_mode,
  price_mode, price_brl, catalog_status, published_at, created_by) values
  ('60000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010',
    (select id from public.product_categories where slug = 'chaveiros' and active), 'Checkout item A', 'codex-checkout-item-a', 'physical', 'ready_to_ship', 'fixed', 50.00, 'published', now(), '10000000-0000-4000-8000-000000000011'),
  ('60000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011',
    (select id from public.product_categories where slug = 'chaveiros' and active), 'Checkout item B', 'codex-checkout-item-b', 'physical', 'ready_to_ship', 'fixed', 50.00, 'published', now(), '10000000-0000-4000-8000-000000000012');

insert into public.marketplace_coupons (code, discount_fixed_cents, created_by)
values ('CODXQA20261115', 1001, '10000000-0000-4000-8000-000000000010');

insert into public.buyer_addresses (id, buyer_id, label, recipient_name, postal_code, street, number, complement, district, city, state_code, reference)
values ('50000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000010', 'Test', 'Test buyer', '11000000', 'Rua Teste', '1', '', 'Centro', 'Santos', 'SP', '');
insert into public.buyer_carts (id, buyer_id)
values ('40000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000010');
insert into public.buyer_cart_items (cart_id, product_id, store_id, store_name, product_name, price_brl, quantity)
select '40000000-0000-4000-8000-000000000010', p.id, p.store_id, s.name, p.name, p.price_brl, 1
from public.marketplace_products p join public.stores s on s.id = p.store_id
where p.id in ('60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000011');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000010';
select is(
  (select discount_cents from public.get_marketplace_coupon_quote('40000000-0000-4000-8000-000000000010', 'CODXQA20261115')),
  1001::bigint,
  'quotes the fixed coupon in cents'
);
select is(
  (select sum(value::bigint) from jsonb_each_text((select store_discounts from public.get_marketplace_coupon_quote('40000000-0000-4000-8000-000000000010', 'CODXQA20261115')))),
  1001::bigint,
  'allocates the entire discount across the seller orders'
);
select count(*) from public.create_orders_from_cart('50000000-0000-4000-8000-000000000010', 'CODXQA20261115');

reset role;
select is((select count(*) from public.seller_purchase_orders where buyer_id = '10000000-0000-4000-8000-000000000010'), 2::bigint, 'creates one order per seller');
select is((select coupon_discount_cents from public.seller_purchase_orders where store_id = '20000000-0000-4000-8000-000000000010'), 501::bigint, 'allocates the rounding cent deterministically to seller A');
select is((select coupon_discount_cents from public.seller_purchase_orders where store_id = '20000000-0000-4000-8000-000000000011'), 500::bigint, 'allocates the remaining seller discount');
select is((select count(*) from public.store_notification_deliveries where order_id in (select id from public.seller_purchase_orders where buyer_id = '10000000-0000-4000-8000-000000000010') and channel = 'email'), 2::bigint, 'queues an email for each seller');
select is((select count(*) from public.store_notification_deliveries where order_id in (select id from public.seller_purchase_orders where buyer_id = '10000000-0000-4000-8000-000000000010') and channel = 'whatsapp'), 1::bigint, 'queues WhatsApp only for the opted-in seller');
select is((select count(*) from public.buyer_cart_items where cart_id = '40000000-0000-4000-8000-000000000010'), 0::bigint, 'empties the buyer cart after order creation');

update public.seller_purchase_orders set status = 'accepted', shipping_quote_status = 'accepted',
  shipping_carrier = 'correios', shipping_service = 'Teste', shipping_cost_cents = 1000, shipping_delivery_days = 5
where buyer_id = '10000000-0000-4000-8000-000000000010';
set local request.jwt.claim.role = 'service_role';
set local role service_role;
select * from public.create_seller_order_payment(
  (select id from public.seller_purchase_orders where store_id = '20000000-0000-4000-8000-000000000010'),
  '10000000-0000-4000-8000-000000000010', 449
);
select * from public.create_seller_order_payment(
  (select id from public.seller_purchase_orders where store_id = '20000000-0000-4000-8000-000000000011'),
  '10000000-0000-4000-8000-000000000010', 450
);
reset role;
select is((select total_cents from public.seller_order_payments p join public.seller_purchase_orders o on o.id = p.order_id where o.store_id = '20000000-0000-4000-8000-000000000010'), 5499::bigint, 'adds shipping after seller-funded discount for seller A');
select is((select marketplace_fee_cents from public.seller_order_payments p join public.seller_purchase_orders o on o.id = p.order_id where o.store_id = '20000000-0000-4000-8000-000000000010'), 449::bigint, 'records commission on seller A discounted subtotal');
select is((select total_cents from public.seller_order_payments p join public.seller_purchase_orders o on o.id = p.order_id where o.store_id = '20000000-0000-4000-8000-000000000011'), 5500::bigint, 'adds shipping after seller-funded discount for seller B');
select is((select marketplace_fee_cents from public.seller_order_payments p join public.seller_purchase_orders o on o.id = p.order_id where o.store_id = '20000000-0000-4000-8000-000000000011'), 450::bigint, 'records commission on seller B discounted subtotal');

select * from finish();
rollback;
