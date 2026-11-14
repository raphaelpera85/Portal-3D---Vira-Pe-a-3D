const DAY_MS = 86_400_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const releaseReportColumns = ["DATE", "SOURCE_ID", "EXTERNAL_REFERENCE", "RECORD_TYPE", "DESCRIPTION", "NET_CREDIT_AMOUNT", "NET_DEBIT_AMOUNT", "GROSS_AMOUNT", "MP_FEE_AMOUNT"] as const;

export function getReleaseReportDateRange(from: string, through: string, now = new Date()) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  const todayInSaoPaulo = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (!validDate(from) || !validDate(through) || from > through || through > todayInSaoPaulo) return null;
  const days = (Date.parse(`${through}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS + 1;
  if (days > 31) return null;
  return { from, through, days, beginDate: new Date(`${from}T00:00:00-03:00`).toISOString(), endDate: new Date(`${through}T23:59:59.999-03:00`).toISOString() };
}

export function hasReleaseReportReconciliationColumns(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const columns = (value as Record<string, unknown>).columns;
  if (!Array.isArray(columns)) return false;
  const keys = new Set(columns.flatMap((column) => column && typeof column === "object" && "key" in column && typeof column.key === "string" ? [column.key] : []));
  return releaseReportColumns.every((key) => keys.has(key));
}

export function buildReleaseReportConfig(current?: unknown) {
  const record = current && typeof current === "object" && !Array.isArray(current) ? current as Record<string, unknown> : {};
  const columns = Array.isArray(record.columns) ? record.columns.filter((column) => column && typeof column === "object" && "key" in column && typeof column.key === "string") as Array<{ key: string }> : [];
  const existingKeys = new Set(columns.map((column) => column.key));
  return {
    file_name_prefix: typeof record.file_name_prefix === "string" && record.file_name_prefix.length <= 50 ? record.file_name_prefix : "virapeca3d",
    include_withdrawal_at_end: typeof record.include_withdrawal_at_end === "boolean" ? record.include_withdrawal_at_end : false,
    execute_after_withdrawal: typeof record.execute_after_withdrawal === "boolean" ? record.execute_after_withdrawal : false,
    display_timezone: typeof record.display_timezone === "string" ? record.display_timezone : "GMT-03",
    ...(Array.isArray(record.notification_email_list) ? { notification_email_list: record.notification_email_list.filter((value): value is string => typeof value === "string") } : {}),
    frequency: record.frequency && typeof record.frequency === "object" && !Array.isArray(record.frequency)
      ? record.frequency : { hour: 0, type: "monthly", value: 1 },
    columns: [...columns, ...releaseReportColumns.filter((key) => !existingKeys.has(key)).map((key) => ({ key }))],
  };
}

function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/^sep=[,;\t]\r?\n/i, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  const delimiter = candidates.map((candidate) => {
    let count = 0; let quoted = false;
    for (const char of firstLine) { if (char === '"') quoted = !quoted; else if (char === candidate && !quoted) count += 1; }
    return { candidate, count };
  }).sort((left, right) => right.count - left.count)[0]?.candidate ?? ",";
  const rows: string[][] = [];
  let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted && char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === delimiter) { row.push(field); field = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); if (row.some((value) => value !== "")) rows.push(row); row = []; field = "";
    } else field += char;
  }
  row.push(field); if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function amountCents(value: string) {
  const clean = value.trim().replace(/[^\d,.-]/g, "");
  if (!clean || !/^-?[\d.,]+$/.test(clean)) return 0;
  const negative = clean.startsWith("-");
  const unsigned = negative ? clean.slice(1) : clean;
  const decimalSeparator = Math.max(unsigned.lastIndexOf("."), unsigned.lastIndexOf(","));
  const whole = unsigned.slice(0, decimalSeparator).replace(/[.,]/g, "") || "0";
  const decimals = decimalSeparator < 0 ? "" : unsigned.slice(decimalSeparator + 1).replace(/[.,]/g, "");
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(decimals)) return 0;
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? (negative ? -cents : cents) : 0;
}

export function listReleaseReportPaymentReferences(csv: string) {
  const rows = parseCsv(csv);
  if (!rows.length) return null;
  const referenceIndex = rows[0].findIndex((heading) => heading.trim().toUpperCase() === "EXTERNAL_REFERENCE");
  if (referenceIndex < 0) return null;
  return [...new Set(rows.slice(1).map((row) => row[referenceIndex]?.trim() ?? "").filter((value) => uuidPattern.test(value)))];
}

export type ReconciliationPayment = { id: string; order_id: string | null; total_cents: number | string; marketplace_fee_cents: number | string; status: string };
export type ReleaseReconciliationRow = {
  paymentId: string; orderId: string | null; paymentStatus: string; providerRows: number;
  expectedGrossCents: number; reportedGrossCents: number; netCreditCents: number; netDebitCents: number; providerFeeCents: number;
};

export function reconcileReleaseReportCsv(csv: string, payments: ReconciliationPayment[]) {
  const rows = parseCsv(csv);
  if (!rows.length) return null;
  const headings = rows[0].map((heading) => heading.trim().toUpperCase());
  const indexes = new Map(headings.map((heading, index) => [heading, index]));
  if (!["EXTERNAL_REFERENCE", "NET_CREDIT_AMOUNT", "NET_DEBIT_AMOUNT", "GROSS_AMOUNT", "MP_FEE_AMOUNT"].every((key) => indexes.has(key))) return null;
  const paymentIds = new Set(payments.map((payment) => payment.id));
  const movements = new Map<string, { count: number; gross: number; credit: number; debit: number; fee: number }>();
  let unlinkedMovements = 0; let unlinkedNetCents = 0;
  for (const row of rows.slice(1)) {
    const get = (key: string) => row[indexes.get(key)!] ?? "";
    const reference = get("EXTERNAL_REFERENCE").trim();
    const credit = amountCents(get("NET_CREDIT_AMOUNT")); const debit = amountCents(get("NET_DEBIT_AMOUNT"));
    if (!reference || !uuidPattern.test(reference) || !paymentIds.has(reference)) { unlinkedMovements += 1; unlinkedNetCents += credit - debit; continue; }
    const movement = movements.get(reference) ?? { count: 0, gross: 0, credit: 0, debit: 0, fee: 0 };
    movement.count += 1; movement.gross += amountCents(get("GROSS_AMOUNT")); movement.credit += credit;
    movement.debit += debit; movement.fee += amountCents(get("MP_FEE_AMOUNT")); movements.set(reference, movement);
  }
  const matched = new Map(payments.map((payment) => [payment.id, payment]));
  const reconciled = [...movements.entries()].map(([paymentId, movement]) => {
    const payment = matched.get(paymentId)!;
    return { paymentId, orderId: payment.order_id, paymentStatus: payment.status, providerRows: movement.count,
      expectedGrossCents: Number(payment.total_cents) - Number(payment.marketplace_fee_cents), reportedGrossCents: movement.gross,
      netCreditCents: movement.credit, netDebitCents: movement.debit, providerFeeCents: movement.fee };
  }).sort((left, right) => left.paymentId.localeCompare(right.paymentId));
  return { reconciled, unlinkedMovements, unlinkedNetCents, matchedPayments: reconciled.length,
    providerReferenceCount: new Set(rows.slice(1).map((row) => row[indexes.get("EXTERNAL_REFERENCE")!]?.trim() ?? "").filter((value) => uuidPattern.test(value))).size };
}
