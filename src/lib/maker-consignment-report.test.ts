import { describe, expect, it } from "vitest";
import { buildMakerConsignmentReport, exportMakerConsignmentReportCsv } from "./maker-consignment-report";

const items = [
  { id: "1", establishment: "Loja Central", product_name: "Suporte", unit_cost_brl: "12.00", sale_price_brl: "42.50", commission_percent: "10", commission_fixed_fee_brl: "1.25", created_at: "2026-11-01T00:00:00Z", movements: [{ movement_type: "delivered" as const, quantity: 3 }, { movement_type: "sold" as const, quantity: 2 }] },
  { id: "2", establishment: "Loja Central", product_name: "=2+2", unit_cost_brl: "5", sale_price_brl: "20", commission_percent: "5", commission_fixed_fee_brl: "0", created_at: "2026-11-02T00:00:00Z", movements: [{ movement_type: "delivered" as const, quantity: 4 }, { movement_type: "sold" as const, quantity: 1 }] },
];

describe("maker consignment report", () => {
  it("aggregates lots by establishment and preserves item-level values", () => {
    const report = buildMakerConsignmentReport(items);

    expect(report.establishments).toEqual([{ name: "Loja Central", delivered: 7, sold: 3, returned: 0, lost: 0, inStock: 4, grossSalesCents: 10500, commissionCents: 1200, receivableCents: 9300, estimatedResultCents: 6400 }]);
    expect(report.lots).toHaveLength(2);
  });

  it("exports summary and lot details without spreadsheet formulas", () => {
    const csv = exportMakerConsignmentReportCsv("Minha loja", buildMakerConsignmentReport(items), new Date("2026-11-13T00:00:00Z"));

    expect(csv).toContain("\uFEFFsep=;");
    expect(csv).toContain('"Resumo por estabelecimento"');
    expect(csv).toContain('"Loja Central";"7";"3"');
    expect(csv).toContain("não representa confirmação de repasse");
    expect(csv).toContain("'=2+2");
  });

  it("formats a negative estimated result as a negative BRL value", () => {
    const loss = [{ ...items[0], establishment: "Loja em teste", unit_cost_brl: "20", sale_price_brl: "10", commission_percent: "0", commission_fixed_fee_brl: "0", movements: [{ movement_type: "delivered" as const, quantity: 1 }, { movement_type: "sold" as const, quantity: 1 }] }];

    expect(exportMakerConsignmentReportCsv("Minha loja", buildMakerConsignmentReport(loss))).toContain("-R$ 10,00");
  });
});
