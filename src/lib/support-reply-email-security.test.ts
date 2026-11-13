import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113032003_restrict_support_reply_email_trigger.sql", import.meta.url), "utf8");

describe("support reply email trigger permissions", () => {
  it("keeps the security-definer trigger function private to trigger execution", () => {
    expect(migration).toMatch(/revoke all privileges on function public\.enqueue_support_reply_email\(\) from public, anon, authenticated/i);
  });
});
