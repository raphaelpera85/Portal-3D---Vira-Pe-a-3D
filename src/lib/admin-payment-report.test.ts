import { describe, expect, it } from "vitest";
import { exportAdminPaymentReportCsv, getAdminPaymentReportRange } from "./admin-payment-report";

describe("admin payment report", () => {
  it("defaults to the latest seven days and makes the end date exclusive", () => {
    expect(getAdminPaymentReportRange(null, null, new Date("2026-11-13T12:00:00Z"))).toEqual({
      from: "2026-11-07", through: "2026-11-13", fromTimestamp: "2026-11-07T00:00:00.000Z", untilTimestamp: "2026-11-14T00:00:00.000Z",
    });
  });

  it("rejects invalid, reversed, and greater than 31-day date ranges", () => {
    expect(getAdminPaymentReportRange("2026-02-30", "2026-03-01")).toBeNull();
    expect(getAdminPaymentReportRange(null, "2026-99-99")).toBeNull();
    expect(getAdminPaymentReportRange("2026-11-14", "2026-11-13")).toBeNull();
    expect(getAdminPaymentReportRange("2026-10-01", "2026-11-01")).toBeNull();
    expect(getAdminPaymentReportRange("2026-10-14", "2026-11-13")).not.toBeNull();
  });

  it("exports nested payment events, escapes spreadsheet formulas, and labels totals as gross", () => {
    const csv = exportAdminPaymentReportCsv([{
      id: "payment-1", order_id: "order-1", purchase_request_id: null, custom_print_request_id: null, designer_service_request_id: null,
      total_cents: 1234, marketplace_fee_cents: 123, status: "paid", provider_status: "approved", provider_order_id: "98765",
      created_at: "2026-11-13T12:00:00.000Z", store: { name: "=SUM(A1)" }, refunds: [{ amount_cents: 100, status: "processed", provider_status: null, created_at: "2026-11-13T12:01:00.000Z" }],
      chargebacks: [{ case_id: "123", amount_cents: 200, currency: "BRL", case_status: "settled", documentation_status: "valid", created_at: "2026-11-13T12:02:00.000Z" }],
    }], "2026-11-07", "2026-11-13");

    expect(csv).toContain("Não representam liquidação");
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain("R$ 12,34");
    expect(csv).toContain("processed: R$ 1,00");
    expect(csv).toContain("settled: 123");
  });
});
