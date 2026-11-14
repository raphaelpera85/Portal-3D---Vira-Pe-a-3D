import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));

import { GET } from "./route";

function makeQuery(data: unknown[], error: unknown = null) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "gte", "lt", "order", "range", "in"]) query[method] = vi.fn().mockReturnValue(query);
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

  it("exports refunds and chargebacks beyond the first 1,000 child rows", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin" }, authorized: true });
    const payment = {
      id: "payment-1", order_id: "order-1", purchase_request_id: null, custom_print_request_id: null,
      designer_service_request_id: null, total_cents: 10000, marketplace_fee_cents: 1000,
      status: "paid", provider_status: "approved", provider_order_id: "mp-1",
      created_at: "2026-11-13T10:00:00.000Z", store: { name: "Loja" },
    };
    const paymentQuery = makeQuery([payment]);
    const refundRows = Array.from({ length: 1001 }, (_, index) => ({
      payment_id: payment.id, amount_cents: 100, status: "processed",
      provider_status: index === 1000 ? "refund-provider-1001" : "processed",
      created_at: "2026-11-13T11:00:00.000Z",
    }));
    const chargebackRows = Array.from({ length: 1001 }, (_, index) => ({
      payment_id: payment.id, case_id: index === 1000 ? "chargeback-proof-1001" : `case-${index}`,
      amount_cents: 100, currency: "BRL", case_status: "in_process",
      documentation_status: "pending", created_at: "2026-11-13T12:00:00.000Z",
    }));
    const refundsQuery = makeQuery([]);
    refundsQuery.range.mockImplementation((from: number, to: number) => Promise.resolve({ data: refundRows.slice(from, to + 1), error: null }));
    const chargebacksQuery = makeQuery([]);
    chargebacksQuery.range.mockImplementation((from: number, to: number) => Promise.resolve({ data: chargebackRows.slice(from, to + 1), error: null }));
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "seller_order_payments" ? paymentQuery
        : table === "seller_order_refunds" ? refundsQuery : chargebacksQuery),
    });

    const response = await GET(new Request("https://portal.test/api/admin/reports/payments?from=2026-11-13&to=2026-11-13"));
    const csv = await response.text();
    expect(response.status).toBe(200);
    expect(refundsQuery.range).toHaveBeenCalledTimes(2);
    expect(chargebacksQuery.range).toHaveBeenCalledTimes(2);
    expect(csv).toContain("refund-provider-1001");
    expect(csv).toContain("chargeback-proof-1001");
  });

  it("rejects child history above its combined limit instead of exporting partial data", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin" }, authorized: true });
    const paymentQuery = makeQuery([{ id: "payment-1" }]);
    const refundsQuery = makeQuery([]);
    refundsQuery.range.mockImplementation((from: number, to: number) => Promise.resolve({
      data: Array.from({ length: Math.min(to - from + 1, 10001 - from) }, () => ({ payment_id: "payment-1" })), error: null,
    }));
    const chargebacksQuery = makeQuery([]);
    const from = vi.fn((table: string) => table === "seller_order_payments" ? paymentQuery
      : table === "seller_order_refunds" ? refundsQuery : chargebacksQuery);
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const response = await GET(new Request("https://portal.test/api/admin/reports/payments?from=2026-11-13&to=2026-11-13"));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "report_history_too_large", maximumRows: 10000 });
    expect(refundsQuery.range).toHaveBeenCalledTimes(11);
    expect(chargebacksQuery.range).not.toHaveBeenCalled();
  });
});
