import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserWithRole: vi.fn(),
  loadSellerActivityReport: vi.fn(),
  exportSellerActivityReportCsv: vi.fn(),
}));

vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/seller-activity-report.server", () => ({ loadSellerActivityReport: mocks.loadSellerActivityReport }));
vi.mock("@/lib/seller-activity-report", () => ({ exportSellerActivityReportCsv: mocks.exportSellerActivityReportCsv }));

import { GET } from "./route";

describe("maker activity report export", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset();
    mocks.loadSellerActivityReport.mockReset().mockResolvedValue({ unavailable: false, rows: [] });
    mocks.exportSellerActivityReportCsv.mockReset().mockReturnValue("\uFEFFsep=;\r\n\"Loja\";\"Minha loja\"");
  });

  it("requires an authenticated maker session", async () => {
    mocks.getUserWithRole.mockResolvedValue({ supabase: null, user: null, authorized: false });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.exportSellerActivityReportCsv).not.toHaveBeenCalled();
  });

  it("exports only the authenticated maker's store report without caching", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "store-1", name: "Minha loja" }, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const supabase = { from: vi.fn().mockReturnValue(query) };
    mocks.getUserWithRole.mockResolvedValue({ supabase, user: { id: "maker-1" }, authorized: true });
    mocks.loadSellerActivityReport.mockResolvedValue({ unavailable: false, rows: [{ label: "Pedidos", sevenDays: 1, thirtyDays: 2 }] });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(query.eq).toHaveBeenCalledWith("owner_user_id", "maker-1");
    expect(mocks.loadSellerActivityReport).toHaveBeenCalledWith(supabase, "store-1");
    expect(mocks.exportSellerActivityReportCsv).toHaveBeenCalledWith("Minha loja", [{ label: "Pedidos", sevenDays: 1, thirtyDays: 2 }]);
  });
});
