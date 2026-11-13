import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserWithRole: vi.fn(),
  loadMakerConsignmentItems: vi.fn(),
  buildMakerConsignmentReport: vi.fn(),
  exportMakerConsignmentReportCsv: vi.fn(),
}));

vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/maker-consignment-report.server", () => ({ loadMakerConsignmentItems: mocks.loadMakerConsignmentItems }));
vi.mock("@/lib/maker-consignment-report", () => ({ buildMakerConsignmentReport: mocks.buildMakerConsignmentReport, exportMakerConsignmentReportCsv: mocks.exportMakerConsignmentReportCsv }));

import { GET } from "./route";

describe("maker consignment report export", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset();
    mocks.loadMakerConsignmentItems.mockReset().mockResolvedValue({ items: [], error: false });
    mocks.buildMakerConsignmentReport.mockReset().mockReturnValue({ establishments: [], lots: [] });
    mocks.exportMakerConsignmentReportCsv.mockReset().mockReturnValue("\uFEFFsep=;\r\nRelatório");
  });

  it("requires a maker session", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: null, supabase: null, authorized: false });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.loadMakerConsignmentItems).not.toHaveBeenCalled();
  });

  it("restricts the report query to the authenticated maker store", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "store-1" }, error: null }) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const supabase = { from: vi.fn().mockReturnValue(query) };
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "maker-1" }, supabase, authorized: true });
    mocks.loadMakerConsignmentItems.mockResolvedValue({ items: [{ id: "lot-1" }], error: false });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("owner_user_id", "maker-1");
    expect(mocks.loadMakerConsignmentItems).toHaveBeenCalledWith(supabase, "store-1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
