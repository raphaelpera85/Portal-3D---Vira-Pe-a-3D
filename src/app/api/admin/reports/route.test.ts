import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserWithRole: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  exportAdminPeriodReportCsv: vi.fn(),
}));

vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/admin-period-report", () => ({ exportAdminPeriodReportCsv: mocks.exportAdminPeriodReportCsv }));

import { GET } from "./route";

describe("admin period report export", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset();
    mocks.createSupabaseAdminClient.mockReset();
    mocks.exportAdminPeriodReportCsv.mockReset().mockReturnValue("\uFEFFsep=;\r\nRelatório");
  });

  it("requires an authenticated administrator", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: null, supabase: null, authorized: false });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("does not expose financial aggregates to other roles", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "maker-1" }, supabase: {}, authorized: false });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("exports uncached aggregates after server authorization", async () => {
    const metrics = [{ window_days: 7, gmv_cents: 1234 }];
    const rpc = vi.fn().mockResolvedValue({ data: metrics, error: null });
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin-1" }, supabase: {}, authorized: true });
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc });

    const response = await GET();

    expect(mocks.getUserWithRole).toHaveBeenCalledWith("admin");
    expect(rpc).toHaveBeenCalledWith("get_admin_marketplace_period_metrics");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toContain("text/csv; charset=utf-8");
    expect(mocks.exportAdminPeriodReportCsv).toHaveBeenCalledWith(metrics);
  });
});
