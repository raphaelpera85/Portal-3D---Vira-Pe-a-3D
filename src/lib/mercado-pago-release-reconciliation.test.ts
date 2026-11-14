import { describe, expect, it } from "vitest";
import { buildReleaseReportConfig, getReleaseReportDateRange, hasReleaseReportReconciliationColumns, listReleaseReportPaymentReferences, reconcileReleaseReportCsv, releaseReportColumns } from "./mercado-pago-release-reconciliation";

const paymentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const csv = `DATE;SOURCE_ID;EXTERNAL_REFERENCE;RECORD_TYPE;DESCRIPTION;NET_CREDIT_AMOUNT;NET_DEBIT_AMOUNT;GROSS_AMOUNT;MP_FEE_AMOUNT\r\n2026-11-12T12:00:00-03:00;;${paymentId};release;payment;95,00;0,00;100,00;-5,00\r\n2026-11-12T13:00:00-03:00;;;release;withdrawal;0,00;20,00;-20,00;0,00`;

describe("Mercado Pago release report reconciliation", () => {
  it("accepts past periods up to 31 days and converts São Paulo boundaries to UTC", () => {
    expect(getReleaseReportDateRange("2026-11-07", "2026-11-13", new Date("2026-11-13T12:00:00Z"))).toMatchObject({
      days: 7, beginDate: "2026-11-07T03:00:00.000Z", endDate: "2026-11-14T02:59:59.999Z",
    });
    expect(getReleaseReportDateRange("2026-10-14", "2026-11-13", new Date("2026-11-13T12:00:00Z"))).not.toBeNull();
    expect(getReleaseReportDateRange("2026-10-13", "2026-11-13", new Date("2026-11-13T12:00:00Z"))).toBeNull();
    expect(getReleaseReportDateRange("2026-11-14", "2026-11-14", new Date("2026-11-13T12:00:00Z"))).toBeNull();
  });

  it("adds only required report columns and preserves existing settings without activating a schedule", () => {
    const current = { file_name_prefix: "maker-report", scheduled: true, display_timezone: "GMT-03", notification_email_list: ["owner@example.com"],
      frequency: { hour: 4, type: "weekly", value: 2 }, columns: [{ key: "DATE" }, { key: "EXTERNAL_REFERENCE" }] };
    const configured = buildReleaseReportConfig(current);
    expect(configured.file_name_prefix).toBe("maker-report");
    expect(configured.notification_email_list).toEqual(["owner@example.com"]);
    expect(configured.frequency).toEqual(current.frequency);
    expect(configured.columns.map(({ key }) => key)).toEqual([...new Set(["DATE", "EXTERNAL_REFERENCE", ...releaseReportColumns])]);
    expect(configured).not.toHaveProperty("scheduled");
    expect(hasReleaseReportReconciliationColumns(configured)).toBe(true);
  });

  it("matches CSV external references only to the maker's own payment rows and aggregates signed money values", () => {
    expect(listReleaseReportPaymentReferences(csv)).toEqual([paymentId]);
    expect(reconcileReleaseReportCsv(csv, [{ id: paymentId, order_id: "order-1", status: "paid", total_cents: 11000, marketplace_fee_cents: 1000 }])).toEqual({
      reconciled: [{ paymentId, orderId: "order-1", paymentStatus: "paid", providerRows: 1, expectedGrossCents: 10000,
        reportedGrossCents: 10000, netCreditCents: 9500, netDebitCents: 0, providerFeeCents: -500 }],
      unlinkedMovements: 1, unlinkedNetCents: -2000, matchedPayments: 1, providerReferenceCount: 1,
    });
    expect(reconcileReleaseReportCsv(csv, [])).toMatchObject({ matchedPayments: 0, unlinkedMovements: 2, unlinkedNetCents: 7500 });
  });

  it("rejects CSV files missing financial columns instead of inventing zero balances", () => {
    expect(listReleaseReportPaymentReferences("DATE;EXTERNAL_REFERENCE\n2026-01-01;" + paymentId)).toEqual([paymentId]);
    expect(reconcileReleaseReportCsv("DATE;EXTERNAL_REFERENCE\n2026-01-01;" + paymentId, [])).toBeNull();
  });
});
