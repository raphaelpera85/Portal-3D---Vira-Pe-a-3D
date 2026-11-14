alter table public.printer_models
  add column official_image_url text,
  add column official_image_source_url text,
  add column official_image_authorized_at timestamptz,
  add constraint printer_models_official_image_authorization_check check (
    (official_image_url is null and official_image_source_url is null and official_image_authorized_at is null)
    or (
      official_image_url is not null
      and official_image_source_url is not null
      and official_image_url like 'https://%'
      and official_image_source_url like 'https://%'
      and official_image_authorized_at is not null
    )
  );
