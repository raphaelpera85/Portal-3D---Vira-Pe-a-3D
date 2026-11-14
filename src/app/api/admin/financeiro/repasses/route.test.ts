import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));

import { POST } from "./route";

const paymentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const csv = `EXTERNAL_REFERENCE;NET_CREDIT_AMOUNT;NET_DEBIT_AMOUNT;GROSS_AMOUNT;MP_FEE_AMOUNT\n${paymentId};95,00;0,00;100,00;-5,00`;

function makeRequest(file?: File) {
  const form = new FormData();
  if (file) form.set("report", file);
  return new Request("https://portal.test/api/admin/financeiro/repasses", { method: "POST", body: form });
}

function makePaymentQuery(data: unknown[] | null, error: unknown = null) {
  const query = { select: vi.fn(), in: vi.fn() };
  query.select.mockReturnValue(query);
  query.in.mockResolvedValue({ data, error });
  return query;
}

describe("admin release reconciliation route", () => {
  beforeEach(() => { mocks.getUserWithRole.mockReset(); mocks.createSupabaseAdminClient.mockReset(); });

  it("requires an administrator before reading payment records", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: null, authorized: false });
    expect((await POST(makeRequest(new File([csv], "report.csv")))).status).toBe(401);
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "maker" }, authorized: false });
    expect((await POST(makeRequest(new File([csv], "report.csv")))).status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("compares a valid report against matching portal payments without caching the result", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin" }, authorized: true });
    const query = makePaymentQuery([{ id: paymentId, order_id: "order-1", status: "paid", total_cents: 10000, marketplace_fee_cents: 500 }]);
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    const response = await POST(makeRequest(new File([csv], "report.csv", { type: "text/csv" })));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(query.in).toHaveBeenCalledWith("id", [paymentId]);
    expect(await response.json()).toMatchObject({ matchedPayments: 1, reconciled: [{ paymentId, orderId: "order-1", expectedGrossCents: 9500, reportedGrossCents: 10000 }] });
  });

  it("rejects absent, malformed, and oversized reports", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin" }, authorized: true });
    expect((await POST(makeRequest())).status).toBe(400);
    expect((await POST(makeRequest(new File(["DATE;EXTERNAL_REFERENCE\n2026-11-14;" + paymentId], "bad.csv")))).status).toBe(400);
    expect((await POST(makeRequest(new File(["x".repeat(1_000_001)], "large.csv")))).status).toBe(413);
    expect((await POST(new Request("https://portal.test/api/admin/financeiro/repasses", { method: "POST", headers: { "content-length": "1100001" }, body: "too large" }))).status).toBe(413);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("fails closed when the administrative database is unavailable", async () => {
    mocks.getUserWithRole.mockResolvedValue({ user: { id: "admin" }, authorized: true });
    const query = makePaymentQuery(null, new Error("database unavailable"));
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    expect((await POST(makeRequest(new File([csv], "report.csv")))).status).toBe(503);
  });
});
