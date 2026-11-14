begin;
select plan(3);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '11000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'whatsapp-consent-test@example.com',
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);
insert into public.user_roles (user_id, role) values ('11000000-0000-4000-8000-000000000001', 'maker');
insert into public.stores (id, owner_user_id, name, slug, status)
values ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Consent test store', 'whatsapp-consent-test', 'published');
insert into public.store_notification_contacts (store_id, email, whatsapp, whatsapp_opt_in, whatsapp_opt_in_at)
values ('21000000-0000-4000-8000-000000000001', 'whatsapp-consent-test@example.com', '+5511999999999', true, now())
on conflict (store_id) do update
  set whatsapp = excluded.whatsapp, whatsapp_opt_in = excluded.whatsapp_opt_in, whatsapp_opt_in_at = excluded.whatsapp_opt_in_at;
insert into public.seller_purchase_orders (id, buyer_id, store_id, store_name)
values
  ('31000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Consent test store'),
  ('31000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Consent test store');
insert into public.store_notification_deliveries (id, order_id, channel, destination, payload, status)
values
  ('41000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'whatsapp', '+5511999999999', '{"request_type":"purchase"}', 'sending'),
  ('41000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', 'whatsapp', '+5511999999999', '{"request_type":"purchase"}', 'failed');

update public.store_notification_contacts
set whatsapp_opt_in = false, whatsapp_opt_in_at = null
where store_id = '21000000-0000-4000-8000-000000000001';

set local role service_role;
set local request.jwt.claim.role = 'service_role';
select is(
  public.authorize_store_notification_whatsapp_delivery('41000000-0000-4000-8000-000000000001'),
  false,
  'does not authorize a sending delivery after WhatsApp consent is revoked'
);
select is(
  (select status from public.store_notification_deliveries where id = '41000000-0000-4000-8000-000000000001'),
  'cancelled',
  'marks the revoked WhatsApp delivery as cancelled'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.retry_store_notification_delivery('41000000-0000-4000-8000-000000000002')$$,
  '42501',
  'Delivery cannot be retried',
  'does not allow retry after consent is revoked'
);

reset role;
select * from finish();
rollback;
