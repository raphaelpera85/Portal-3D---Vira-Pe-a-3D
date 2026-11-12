import { describe, expect, it } from "vitest";
import { listMercadoPagoOrderChargebacks, parseMercadoPagoChargebackCase } from "./mercado-pago-chargebacks";

describe("Mercado Pago chargeback parsing", () => {
  it("extracts valid numeric case IDs from a charged-back order", () => {
    expect(listMercadoPagoOrderChargebacks({ transactions: { chargebacks: [
      { case_id: "123456789", status: "in_process", amount: "50.00" },
      { case_id: "bad/id", status: "settled" },
      { id: "CBK123", status: "settled" },
    ] } })).toEqual([{ caseId: "123456789", status: "in_process", amountCents: 5_000 }]);
  });

  it("keeps only the expected case details and validates status and dates", () => {
    expect(parseMercadoPagoChargebackCase({
      id: "123456789", reason: "unauthorized", reason_id: "6", amount: "50.00", currency: "BRL",
      coverage_applied: null, coverage_eligible: true, documentation_status: "pending",
      date_documentation_deadline: "2026-11-20T23:59:59-03:00", date_last_updated: "2026-11-12T10:00:00Z",
    }, "123456789")).toEqual({
      caseId: "123456789", reason: "unauthorized", reasonId: "6", amountCents: 5_000, currency: "BRL",
      coverageApplied: null, coverageEligible: true, documentationStatus: "pending",
      documentationDeadline: "2026-11-21T02:59:59.000Z", providerUpdatedAt: "2026-11-12T10:00:00.000Z",
    });
    expect(parseMercadoPagoChargebackCase({ id: "other", documentation_status: "pending" }, "123456789")).toBeNull();
    expect(parseMercadoPagoChargebackCase({ id: "123456789", documentation_status: "forged" }, "123456789")).toBeNull();
  });
});
