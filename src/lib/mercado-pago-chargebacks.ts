import { mercadoPagoAmountToCents } from "./mercado-pago-payments";

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const validCaseId = (value: unknown): value is string => typeof value === "string" && /^\d{1,30}$/.test(value);
const isoDate = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
};
const documentationStatuses = ["pending", "review_pending", "valid", "invalid", "not_supplied", "not_applicable"] as const;

export function listMercadoPagoOrderChargebacks(value: unknown) {
  const order = asObject(value);
  const transactions = asObject(order.transactions);
  const chargebacks = Array.isArray(transactions.chargebacks) ? transactions.chargebacks : [];
  return chargebacks.flatMap((value) => {
    const chargeback = asObject(value);
    if (!validCaseId(chargeback.case_id) || typeof chargeback.status !== "string" || !/^[a-z_]{1,40}$/.test(chargeback.status)) return [];
    const amountCents = chargeback.amount === undefined ? null : mercadoPagoAmountToCents(chargeback.amount);
    if (chargeback.amount !== undefined && amountCents === null) return [];
    return [{ caseId: chargeback.case_id, status: chargeback.status, amountCents }];
  });
}

export function parseMercadoPagoChargebackCase(value: unknown, expectedCaseId: string) {
  const chargeback = asObject(value);
  if (!validCaseId(expectedCaseId) || chargeback.id !== expectedCaseId
    || typeof chargeback.currency !== "string" || !/^[A-Z]{3}$/.test(chargeback.currency)
    || !documentationStatuses.includes(chargeback.documentation_status as typeof documentationStatuses[number])) return null;
  const amountCents = mercadoPagoAmountToCents(chargeback.amount);
  if (amountCents === null) return null;
  return {
    caseId: expectedCaseId,
    reason: typeof chargeback.reason === "string" ? chargeback.reason.slice(0, 120) : null,
    reasonId: typeof chargeback.reason_id === "string" ? chargeback.reason_id.slice(0, 40) : null,
    amountCents,
    currency: chargeback.currency,
    coverageApplied: typeof chargeback.coverage_applied === "boolean" ? chargeback.coverage_applied : null,
    coverageEligible: typeof chargeback.coverage_eligible === "boolean" ? chargeback.coverage_eligible : null,
    documentationStatus: chargeback.documentation_status as typeof documentationStatuses[number],
    documentationDeadline: isoDate(chargeback.date_documentation_deadline),
    providerUpdatedAt: isoDate(chargeback.date_last_updated),
  };
}
