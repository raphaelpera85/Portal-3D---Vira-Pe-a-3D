begin;
select plan(2);

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
insert into public.user_roles (user_id, role) values ('10000000-0000-4000-8000-000000000001', 'maker');
insert into public.stores (id, owner_user_id, name, slug, status)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Test store', 'null-response-test-store', 'published');
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

reset role;
select * from finish();
rollback;
