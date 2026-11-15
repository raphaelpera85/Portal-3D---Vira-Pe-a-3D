begin;
select plan(6);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '10000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'seller-order-null-test@example.com',
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '10000000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'seller-order-other-test@example.com',
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);
insert into public.user_roles (user_id, role) values ('10000000-0000-4000-8000-000000000001', 'maker');
insert into public.user_roles (user_id, role) values ('10000000-0000-4000-8000-000000000002', 'maker');
insert into public.stores (id, owner_user_id, name, slug, status)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Test store', 'null-response-test-store', 'published');
insert into public.stores (id, owner_user_id, name, slug, status)
values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Other store', 'other-response-test-store', 'published');
insert into public.seller_purchase_orders (id, buyer_id, store_id, store_name)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Test store');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.respond_to_seller_purchase_order('30000000-0000-4000-8000-000000000001', null::text)$$,
  '22023',
  'Invalid order response',
  'rejects a null response'
);
select is(
  (select status from public.seller_purchase_orders where id = '30000000-0000-4000-8000-000000000001'),
  'pending',
  'keeps the maker order pending after a null response'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.respond_to_seller_purchase_order('30000000-0000-4000-8000-000000000001', 'accept')$$,
  '42501',
  'Order is not available to this maker',
  'rejects a different maker'
);

reset role;
select is(
  (select status from public.seller_purchase_orders where id = '30000000-0000-4000-8000-000000000001'),
  'pending',
  'does not change the order for a different maker'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select lives_ok(
  $$select public.respond_to_seller_purchase_order('30000000-0000-4000-8000-000000000001', 'accept')$$,
  'lets the owning maker accept a pending order'
);
reset role;
select is(
  (select status from public.seller_purchase_orders where id = '30000000-0000-4000-8000-000000000001'),
  'accepted',
  'records the accepted status'
);

select * from finish();
rollback;
