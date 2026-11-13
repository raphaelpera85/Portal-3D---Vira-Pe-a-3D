alter table public.seller_purchase_orders
  add column shipping_quote_packages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(shipping_quote_packages) = 'array' and jsonb_array_length(shipping_quote_packages) <= 50);

alter table public.custom_print_deliveries
  add column shipping_quote_packages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(shipping_quote_packages) = 'array' and jsonb_array_length(shipping_quote_packages) <= 50);

create function public.is_valid_melhor_envio_packages(p_packages jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare package jsonb; package_count integer;
begin
  if jsonb_typeof(p_packages) <> 'array' then return false; end if;
  package_count := jsonb_array_length(p_packages);
  if package_count < 1 or package_count > 50 then return false; end if;
  for package in select value from jsonb_array_elements(p_packages) loop
    if jsonb_typeof(package) <> 'object'
      or (package ->> 'height')::numeric not between 1 and 1000
      or (package ->> 'width')::numeric not between 1 and 1000
      or (package ->> 'length')::numeric not between 1 and 1000
      or (package ->> 'weight')::numeric not between 0.01 and 30000 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.is_valid_melhor_envio_packages(jsonb) from public, anon, authenticated;

create function public.set_seller_order_shipping_quote_with_packages(
  p_order_id uuid, p_carrier text, p_service text, p_shipping_cents bigint, p_delivery_days smallint,
  p_provider_service_id bigint, p_packages jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_carrier is distinct from 'melhor_envio' or not public.is_valid_melhor_envio_packages(p_packages) then
    raise exception using errcode = '22023', message = 'Invalid shipping packages';
  end if;
  perform public.set_seller_order_shipping_quote(p_order_id, p_carrier, p_service, p_shipping_cents,
    p_delivery_days, p_provider_service_id);
  update public.seller_purchase_orders set shipping_quote_packages = p_packages, updated_at = now()
    where id = p_order_id;
end;
$$;
revoke all on function public.set_seller_order_shipping_quote_with_packages(uuid, text, text, bigint, smallint, bigint, jsonb) from public, anon;
grant execute on function public.set_seller_order_shipping_quote_with_packages(uuid, text, text, bigint, smallint, bigint, jsonb) to authenticated;

create function public.set_custom_print_shipping_quote_with_packages(
  p_request_id uuid, p_carrier text, p_service text, p_shipping_cents bigint, p_delivery_days smallint,
  p_provider_service_id bigint, p_packages jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare first_package jsonb;
begin
  if p_carrier is distinct from 'melhor_envio' or not public.is_valid_melhor_envio_packages(p_packages) then
    raise exception using errcode = '22023', message = 'Invalid shipping packages';
  end if;
  first_package := p_packages -> 0;
  perform public.set_custom_print_shipping_quote(p_request_id, p_carrier, p_service, p_shipping_cents,
    p_delivery_days, p_provider_service_id, (first_package ->> 'width')::numeric,
    (first_package ->> 'height')::numeric, (first_package ->> 'length')::numeric,
    (first_package ->> 'weight')::numeric);
  update public.custom_print_deliveries set shipping_quote_packages = p_packages, updated_at = now()
    where request_id = p_request_id;
end;
$$;
revoke all on function public.set_custom_print_shipping_quote_with_packages(uuid, text, text, bigint, smallint, bigint, jsonb) from public, anon;
grant execute on function public.set_custom_print_shipping_quote_with_packages(uuid, text, text, bigint, smallint, bigint, jsonb) to authenticated;

create function public.clear_shipping_quote_packages_on_reset()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.shipping_quote_status in ('awaiting_quote', 'declined')
    or old.delivery_postal_code is distinct from new.delivery_postal_code then new.shipping_quote_packages := '[]'::jsonb; end if;
  return new;
end;
$$;
revoke all on function public.clear_shipping_quote_packages_on_reset() from public, anon, authenticated;
create trigger clear_seller_shipping_quote_packages_before_reset
  before update of shipping_quote_status, delivery_postal_code on public.seller_purchase_orders
  for each row execute function public.clear_shipping_quote_packages_on_reset();
create trigger clear_custom_print_shipping_quote_packages_before_reset
  before update of shipping_quote_status, delivery_postal_code on public.custom_print_deliveries
  for each row execute function public.clear_shipping_quote_packages_on_reset();

alter table public.seller_order_shipping_labels
  add column package_count smallint not null default 1 check (package_count between 1 and 50),
  drop constraint seller_order_shipping_labels_status_check,
  add constraint seller_order_shipping_labels_status_check check (status in (
    'creating', 'cart_partial_uncertain', 'carted', 'checkout_started', 'checkout_uncertain', 'paid', 'generating', 'generated',
    'posted', 'delivered', 'cancelled', 'failed'
  ));

create table public.seller_order_shipping_label_packages (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.seller_order_shipping_labels(id) on delete cascade,
  package_index smallint not null check (package_index between 1 and 50),
  provider_order_id text not null unique check (char_length(provider_order_id) between 1 and 120),
  packages jsonb not null default '[]'::jsonb check (jsonb_typeof(packages) = 'array' and jsonb_array_length(packages) <= 50),
  status text not null check (status in (
    'carted', 'checkout_started', 'checkout_uncertain', 'paid', 'generating', 'generated', 'posted', 'delivered', 'cancelled', 'failed'
  )),
  shipping_cost_cents bigint check (shipping_cost_cents is null or shipping_cost_cents between 0 and 100000000),
  provider_status text,
  tracking_code text,
  tracking_url text check (tracking_url is null or (char_length(tracking_url) <= 2048 and tracking_url ~ '^https://[A-Za-z0-9.-]+(/[^[:space:]]*)?$')),
  print_url text check (print_url is null or (char_length(print_url) <= 2048 and print_url ~ '^https://[A-Za-z0-9.-]+(/[^[:space:]]*)?$')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (label_id, package_index)
);
insert into public.seller_order_shipping_label_packages (
  label_id, package_index, provider_order_id, packages, status, shipping_cost_cents, provider_status,
  tracking_code, tracking_url, print_url, updated_at, created_at
)
select id, 1, provider_order_id, '[]'::jsonb,
  status,
  shipping_cost_cents, provider_status, tracking_code, tracking_url, print_url, updated_at, created_at
from public.seller_order_shipping_labels where provider_order_id is not null
  and status in ('carted', 'checkout_started', 'checkout_uncertain', 'paid', 'generating', 'generated', 'posted', 'delivered', 'cancelled', 'failed');
create index seller_order_shipping_label_packages_label on public.seller_order_shipping_label_packages(label_id, package_index);
alter table public.seller_order_shipping_label_packages enable row level security;
revoke all on public.seller_order_shipping_label_packages from public, anon, authenticated;
grant all on public.seller_order_shipping_label_packages to service_role;
create function public.get_shipping_label_packages()
returns table (
  order_id uuid, custom_print_request_id uuid, package_index smallint, packages jsonb,
  status text, tracking_code text, tracking_url text
) language sql stable security definer set search_path = '' as $$
  select l.order_id, l.custom_print_request_id, p.package_index, p.packages, p.status, p.tracking_code, p.tracking_url
  from public.seller_order_shipping_label_packages p
  join public.seller_order_shipping_labels l on l.id = p.label_id
  left join public.seller_purchase_orders o on o.id = l.order_id
  left join public.custom_print_requests q on q.id = l.custom_print_request_id
  where o.buyer_id = (select auth.uid()) or q.buyer_id = (select auth.uid())
  order by p.created_at, p.package_index;
$$;
revoke all on function public.get_shipping_label_packages() from public, anon;
grant execute on function public.get_shipping_label_packages() to authenticated;
