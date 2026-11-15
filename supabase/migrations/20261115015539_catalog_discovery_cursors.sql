create table public.catalog_discovery_cursors (
  manufacturer text primary key check (manufacturer in ('Anycubic', 'ELEGOO', 'Creality')),
  next_page integer not null default 2 check (next_page between 2 and 501)
);

alter table public.catalog_discovery_cursors enable row level security;
revoke all on public.catalog_discovery_cursors from public, anon, authenticated;
grant select, insert, update on public.catalog_discovery_cursors to service_role;
