import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261115001642_model_print_profile_sharing.sql", import.meta.url), "utf8");

describe("shared model print profile migration", () => {
  it("keeps direct reads limited to safe profile metadata", () => {
    expect(migration).toContain("revoke select on public.model_print_profiles from anon, authenticated");
    expect(migration).toContain("grant select (id, model_slug, sharing_scope, review_status) on public.model_print_profiles to authenticated");
    expect(migration).toContain("create view public.visible_model_print_profiles with (security_barrier = true)");
    expect(migration).not.toMatch(/create view public\.visible_model_print_profiles[\s\S]*?select[\s\S]*?user_id\s*,/i);
  });

  it("publishes only approved shared profiles and reserves review writes for catalog admins", () => {
    expect(migration).toContain("Anyone can read published shared model print profiles");
    expect(migration).toContain("sharing_scope in ('community', 'official') and review_status = 'published'");
    expect(migration).toContain("Catalog admins curate shared model print profiles");
    expect(migration).toContain("using ((select public.is_catalog_admin()))");
    expect(migration).toContain("audit_model_print_profile_review_status");
  });
});
