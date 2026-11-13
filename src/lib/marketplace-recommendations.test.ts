import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113034848_recommended_marketplace_stores.sql", import.meta.url), "utf8");

describe("public marketplace store recommendations", () => {
  it("ranks only published stores with published products and public store reviews", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("p.catalog_status = 'published'");
    expect(migration).toContain("s.status = 'published'");
    expect(migration).toContain("r.review_type = 'store' and r.status = 'published'");
    expect(migration).toContain("avg(r.rating) desc nulls last");
    expect(migration).toContain("limit 4");
    expect(migration).toContain("grant select (status) on public.marketplace_reviews to anon");
    expect(migration).not.toContain("security definer");
    expect(migration).not.toContain("buyer_id");
    expect(migration).not.toContain("r.body");
  });
});
