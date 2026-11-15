import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261115015620_digital_download_stats.sql", import.meta.url), "utf8");

describe("digital asset download statistics RPC", () => {
  it("returns only the authenticated buyer's per-request count and latest download", () => {
    expect(migration).toMatch(/security invoker\s+set search_path = ''/);
    expect(migration).toContain("where downloads.buyer_id = (select auth.uid())");
    expect(migration).toContain("count(*)::bigint, max(downloads.created_at)");
    expect(migration).toContain("group by downloads.request_id");
    expect(migration).toContain("revoke all on function public.get_my_digital_asset_download_stats() from public, anon");
    expect(migration).toContain("grant execute on function public.get_my_digital_asset_download_stats() to authenticated");
  });
});
