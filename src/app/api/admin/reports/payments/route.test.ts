import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));

import { GET } from "./route";

function makeQuery(data: unknown[], error: unknown = null) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "gte", "lt", "order", "range"]) query[method] = vi.fn().mockReturnValue(query);
  query.range.mockResolvedValue({ data, error });
  return query;
}

describe("admin payment report route", () => {
  beforeEach(() => { mocks.getUserWithRole.mockReset(); mocks.createSupabaseAdminClient.mockReset(); });

  it("requires an administrator before creating the privileged database client", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: null, authorized: false });
    expect((await GET(new Request("https://portal.test/api/admin/reports/payments"))).status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "maker" }, authorized: false });
    expect((await GET(new Request("https://portal.test/api/admin/reports/payments"))).status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("validates the date window and returns a private uncached export", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin" }, authorized: true });
    const query = makeQuery([]);
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    const response = await GET(new Request("https://portal.test/api/admin/reports/payments?from=2026-11-07&to=2026-11-13"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toContain("text/csv; charset=utf-8");
    expect(query.gte).toHaveBeenCalledWith("created_at", "2026-11-07T00:00:00.000Z");
    expect(query.lt).toHaveBeenCalledWith("created_at", "2026-11-14T00:00:00.000Z");
  });

  it("rejects invalid ranges without querying payments", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin" }, authorized: true });
    expect((await GET(new Request("https://portal.test/api/admin/reports/payments?from=2026-10-01&to=2026-11-01"))).status).toBe(400);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("stops instead of returning a partial export when more than 5,000 payments match", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin" }, authorized: true });
    const query = makeQuery([]);
    query.range.mockImplementation((from: number) => Promise.resolve({ data: Array.from({ length: from < 5000 ? 1000 : 1 }, () => ({})), error: null }));
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    const response = await GET(new Request("https://portal.test/api/admin/reports/payments"));
    expect(response.status).toBe(413);
    expect(query.range).toHaveBeenCalledTimes(6);
  });
});
