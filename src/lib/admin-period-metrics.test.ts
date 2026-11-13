import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113013250_admin_period_metrics.sql", import.meta.url), "utf8");

describe("admin period metrics RPC", () => {
  it("restricts financial aggregates to the service role", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("uses rolling 7/30-day creation windows and current confirmed statuses", () => {
    expect(migration).toContain("from (values (7), (30))");
    expect(migration.match(/p\.created_at >= statement_timestamp\(\) - make_interval\(days => windows\.days\)/g)).toHaveLength(3);
    expect(migration).toContain("p.status in ('paid', 'partially_refunded', 'refunded', 'charged_back')");
    expect(migration).toContain("r.status = 'processed' and r.created_at >=");
    expect(migration).toContain("c.status = 'processed' and c.created_at >=");
  });
});
