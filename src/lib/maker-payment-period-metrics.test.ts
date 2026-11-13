import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113033038_maker_payment_period_metrics.sql", import.meta.url), "utf8");

describe("maker payment period metrics RPC", () => {
  it("only returns paid totals for the authenticated maker's store", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("select auth.uid()");
    expect(migration).toContain("r.role = 'maker'::public.app_role");
    expect(migration).toContain("s.owner_user_id = (select auth.uid())");
    expect(migration).toContain("p.store_id = maker_store_id");
    expect(migration).toContain("p.status = 'paid'");
    expect(migration).toContain("from (values (7), (30))");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});
