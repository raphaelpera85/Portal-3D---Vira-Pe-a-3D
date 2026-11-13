create or replace function public.enforce_product_quote_request_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := statement_timestamp();
  return new;
end;
$$;

create trigger enforce_product_quote_request_created_at_before_insert
before insert on public.product_quote_requests
for each row execute function public.enforce_product_quote_request_created_at();
