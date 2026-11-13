import { describe, expect, it } from "vitest";
import { exportSellerActivityReportCsv } from "./seller-activity-report";

describe("exportSellerActivityReportCsv", () => {
  it("exports the displayed seven and thirty day activity as a Brazilian spreadsheet CSV", () => {
    const csv = exportSellerActivityReportCsv("Loja ViraPeça", [
      { label: "Pedidos do carrinho", sevenDays: 2, thirtyDays: 5 },
      { label: "Orçamentos de produtos", sevenDays: 1, thirtyDays: 3 },
    ], new Date("2026-11-13T12:00:00.000Z"));

    expect(csv.startsWith("\uFEFFsep=;\r\n")).toBe(true);
    expect(csv).toContain('"Loja";"Loja ViraPeça"');
    expect(csv).toContain('"Tipo e situação";"7 dias";"30 dias"');
    expect(csv).toContain('"Critério";"Contagens usam a data de criação e o status atual; não representam receita ou pagamentos confirmados."');
    expect(csv).toContain('"Pedidos do carrinho";"2";"5"');
    expect(csv).toContain("13/11/2026");
  });

  it("escapes separators, newlines, and formula-like store names", () => {
    const csv = exportSellerActivityReportCsv('=HYPERLINK("https://example.invalid")', [
      { label: "Pedidos; novos\npendentes", sevenDays: 0, thirtyDays: 1 },
    ]);

    expect(csv).toContain('"Loja";"\'=HYPERLINK(""https://example.invalid"")"');
    expect(csv).toContain('"Pedidos; novos\npendentes";"0";"1"');
  });
});
