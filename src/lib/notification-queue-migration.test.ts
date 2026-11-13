import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113090228_recover_exhausted_notification_deliveries.sql", import.meta.url), "utf8");

describe("notification delivery recovery migration", () => {
  it("marks an expired final attempt failed before claiming only retryable deliveries", () => {
    const exhaustedTransition = migration.indexOf("set status = 'failed'");
    const claim = migration.indexOf("return query");

    expect(exhaustedTransition).toBeGreaterThanOrEqual(0);
    expect(claim).toBeGreaterThan(exhaustedTransition);
    expect(migration).toMatch(/set status = 'failed',[\s\S]*?where status = 'sending' and attempts >= 5 and updated_at < now\(\) - interval '10 minutes'/);
    expect(migration).toMatch(/if coalesce\(auth\.role\(\), ''\) <> 'service_role' then/);
    expect(migration).toMatch(/where d\.attempts < 5 and \([\s\S]*?d\.status = 'sending' and d\.updated_at < now\(\) - interval '10 minutes'/);
    expect(migration).toContain("grant execute on function public.claim_store_notification_deliveries(integer) to service_role");
  });
});
