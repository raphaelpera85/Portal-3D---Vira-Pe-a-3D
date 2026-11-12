create table public.store_melhor_envio_connections (
  store_id uuid primary key references public.stores (id) on delete cascade,
  provider_user_id text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz not null,
  scopes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.store_melhor_envio_connections enable row level security;
revoke all on public.store_melhor_envio_connections from public, anon, authenticated;
grant all on public.store_melhor_envio_connections to service_role;

