alter table public.store_shipping_origins
  add column sender_name text,
  add column sender_email text,
  add column sender_phone text,
  add column sender_document text,
  add column sender_state_register text,
  add column sender_street text,
  add column sender_number text,
  add column sender_complement text not null default '',
  add column sender_district text,
  add column sender_city text,
  add column sender_state_code text,
  add constraint store_shipping_sender_profile_check check (
    (sender_name is null and sender_email is null and sender_phone is null and sender_document is null
      and sender_state_register is null and sender_street is null and sender_number is null
      and sender_district is null and sender_city is null and sender_state_code is null)
    or coalesce((char_length(btrim(sender_name)) between 2 and 100 and sender_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and sender_phone ~ '^\d{10,13}$' and sender_document ~ '^([A-Z0-9]{14}|\d{11})$'
      and char_length(btrim(sender_state_register)) between 1 and 30
      and char_length(btrim(sender_street)) between 2 and 120 and char_length(btrim(sender_number)) between 1 and 20
      and char_length(sender_complement) <= 100 and char_length(btrim(sender_district)) between 2 and 100
      and char_length(btrim(sender_city)) between 2 and 100 and sender_state_code ~ '^[A-Z]{2}$'), false)
  );

revoke insert, update, delete on public.store_shipping_origins from public, anon, authenticated;
grant select on public.store_shipping_origins to authenticated;

create table public.seller_order_shipping_labels (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.seller_purchase_orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  provider_order_id text unique,
  status text not null check (status in (
    'creating', 'carted', 'checkout_started', 'checkout_uncertain', 'paid', 'generating', 'generated',
    'posted', 'delivered', 'cancelled', 'failed'
  )),
  shipping_cost_cents bigint check (shipping_cost_cents is null or shipping_cost_cents between 0 and 100000000),
  provider_status text,
  tracking_code text,
  tracking_url text,
  print_url text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint seller_order_shipping_labels_tracking_url_check check (
    tracking_url is null or (char_length(tracking_url) <= 2048 and tracking_url ~ '^https://[A-Za-z0-9.-]+(/[^[:space:]]*)?$')
  ),
  constraint seller_order_shipping_labels_print_url_check check (
    print_url is null or (char_length(print_url) <= 2048 and print_url ~ '^https://[A-Za-z0-9.-]+(/[^[:space:]]*)?$')
  )
);

create index seller_order_shipping_labels_store_recent on public.seller_order_shipping_labels(store_id, created_at desc);
alter table public.seller_order_shipping_labels enable row level security;
revoke all on public.seller_order_shipping_labels from public, anon, authenticated;
grant all on public.seller_order_shipping_labels to service_role;
