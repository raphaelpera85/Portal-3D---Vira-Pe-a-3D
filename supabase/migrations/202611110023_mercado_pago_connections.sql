create table public.store_payment_connections (
  store_id uuid primary key references public.stores (id) on delete cascade,
  provider text not null default 'mercado_pago' check (provider = 'mercado_pago'),
  provider_user_id text not null unique,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz not null,
  scopes text not null default '',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_payment_connections enable row level security;
revoke all on public.store_payment_connections from anon, authenticated;
