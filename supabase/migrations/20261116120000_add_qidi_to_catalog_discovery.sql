alter table public.catalog_discovery_candidates
  drop constraint if exists catalog_discovery_candidates_source_url_check;

alter table public.catalog_discovery_candidates
  add constraint catalog_discovery_candidates_source_url_check
  check (
    char_length(source_url) <= 2048
    and source_url ~ '^https://(store\.anycubic\.com|us\.elegoo\.com|us\.store\.creality\.com|us\.qidi3d\.com)/products/[a-z0-9]+(-[a-z0-9]+)*$'
  );

alter table public.catalog_discovery_cursors
  drop constraint if exists catalog_discovery_cursors_manufacturer_check;

alter table public.catalog_discovery_cursors
  add constraint catalog_discovery_cursors_manufacturer_check
  check (manufacturer in ('Anycubic', 'ELEGOO', 'Creality', 'QIDI Tech'));
