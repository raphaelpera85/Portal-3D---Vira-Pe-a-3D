drop policy "Anyone can read published creator models" on public.creator_model_submissions;
drop policy "Creators can read their own model submissions" on public.creator_model_submissions;
drop policy "Marketplace admins can read all creator models" on public.creator_model_submissions;
drop policy "Published store owners can submit models for review" on public.creator_model_submissions;

create policy "Anyone can read published creator models"
  on public.creator_model_submissions for select to anon
  using (review_status = 'published');
create policy "Authenticated users can read published or authorized creator models"
  on public.creator_model_submissions for select to authenticated
  using (
    review_status = 'published'
    or submitted_by = (select auth.uid())
    or (select public.is_catalog_admin())
  );

revoke insert (id, store_id, submitted_by, name, category_slug, asset_path, tags, creator_name, source_url, rights_confirmed_at)
  on public.creator_model_submissions from authenticated;
