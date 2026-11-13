import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113034012_admin_support_response_metrics.sql", import.meta.url), "utf8");

describe("admin support response metrics RPC", () => {
  it("returns only first-response aggregates to administrators", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("r.role = 'admin'::public.app_role");
    expect(migration).toContain("m.sender_role = 'admin'::public.app_role");
    expect(migration).toContain("m.created_at >= t.created_at");
    expect(migration).toContain("order by m.created_at asc");
    expect(migration).toContain("from (values (7), (30))");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
    expect(migration).not.toContain("m.body");
  });
});
