import { describe, expect, it } from "vitest";
import { exportAdminPeriodReportCsv, type AdminPeriodMetric } from "./admin-period-report";

const metrics: AdminPeriodMetric[] = [{
  window_days: 7,
  paid_payment_count: 12,
  gmv_cents: 123456,
  gross_marketplace_fee_cents: 12345,
  processed_refund_count: 1,
  processed_refund_cents: 5000,
  confirmed_cancellation_count: 2,
  chargeback_case_count: 1,
}];

describe("admin period report CSV", () => {
  it("exports gross period totals with a clear accounting caveat", () => {
    const csv = exportAdminPeriodReportCsv(metrics, new Date("2026-11-13T00:00:00.000Z"));

    expect(csv).toContain("\uFEFFsep=;");
    expect(csv).toContain('"GMV bruto · sem frete";"R$ 1.234,56"');
    expect(csv).toContain('"Comissão bruta registrada";"R$ 123,45"');
    expect(csv).toContain("status atual");
    expect(csv).toContain("sem liquidação");
  });

  it("keeps the report usable when a metric window is unavailable", () => {
    const csv = exportAdminPeriodReportCsv([]);

    expect(csv).toContain('"7 dias"');
    expect(csv).toContain('"30 dias"');
    expect(csv).toContain('"Pagamentos confirmados";"0";"0"');
  });
});
