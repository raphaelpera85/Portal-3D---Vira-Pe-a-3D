import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113032320_restrict_trigger_function_permissions.sql", import.meta.url), "utf8");

describe("trigger function permissions", () => {
  it("revokes direct API execution from trigger-only functions", () => {
    for (const functionName of ["bootstrap_store_notification_contacts", "enforce_product_quote_request_created_at", "guard_digital_product_publication", "guard_reserved_maker_inventory"]) {
      expect(migration).toContain(`revoke all privileges on function public.${functionName}() from public, anon, authenticated`);
    }
  });
});
