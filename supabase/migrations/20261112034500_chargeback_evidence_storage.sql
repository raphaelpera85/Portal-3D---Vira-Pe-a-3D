insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chargeback-evidence', 'chargeback-evidence', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

alter table public.seller_order_chargebacks
  add column documents_sent_at timestamptz,
  add column documents_count integer not null default 0 check (documents_count between 0 and 10);

create table public.seller_order_chargeback_evidence_uploads (
  object_path text primary key,
  case_id text not null references public.seller_order_chargebacks (case_id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null check (file_size between 1 and 10485760),
  created_at timestamptz not null default now(),
  check (object_path ~ ('^' || store_id::text || '/' || case_id || '/[0-9a-f-]{36}[.](pdf|jpg|jpeg|png)$'))
);
create index seller_order_chargeback_evidence_uploads_expiry on public.seller_order_chargeback_evidence_uploads (created_at);
alter table public.seller_order_chargeback_evidence_uploads enable row level security;
revoke all on public.seller_order_chargeback_evidence_uploads from anon, authenticated;
grant all on public.seller_order_chargeback_evidence_uploads to service_role;
