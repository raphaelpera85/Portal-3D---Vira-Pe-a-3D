import { describe, expect, it } from "vitest";
import { calculatePrintPrice, type PrintCostInput, type SalesChannel } from "./pricing";
import { exportPrintCalculationCsv } from "./pricing-export";

const input: PrintCostInput = {
  batchQuantity: 2, batchFixedCost: 1, material: "PLA", filamentGrams: 20, filamentPricePerKg: 100,
  printHours: 1, averagePowerWatts: 100, energyPricePerKwh: 1, machineCostPerHour: 2,
  depreciationPerHour: 1, maintenancePerHour: 0, laborMinutes: 10, laborRatePerHour: 30,
  overheadPerUnit: 0, failureReservePercent: 0, targetMarginPercent: 20,
  additionalCosts: [{ name: 'Embalagem; =HYPERLINK("https://bad")', amount: 1 }],
};
const channels: SalesChannel[] = [{ id: "marketplace", name: "Marketplace", feePercent: 10, fixedFee: 1, logisticsCost: 2.5 }];

describe("exportPrintCalculationCsv", () => {
  it("exports cost breakdown and channel prices in a spreadsheet-friendly Brazilian CSV", () => {
    const result = calculatePrintPrice(input, channels);
    const csv = exportPrintCalculationCsv("Suporte de mesa", input, channels, result, new Date("2026-11-12T12:00:00.000Z"));

    expect(csv.startsWith("\uFEFFsep=;\r\n")).toBe(true);
    expect(csv).toContain('"Cálculo";"Suporte de mesa"');
    expect(csv).toContain('"Custo total do lote (R$)"');
    expect(csv).toContain('"Marketplace";"10";"1,00";"2,50"');
    expect(csv).toContain("12/11/2026");
  });

  it("exports a separate mass and price subtotal for each imported filament", () => {
    const imported = { ...input, filamentCosts: [{ name: "PLA", color: "#ff0000", grams: 12, pricePerKg: 100 }] };
    const csv = exportPrintCalculationCsv("Suporte", imported, channels, calculatePrintPrice(imported, channels));

    expect(csv).toContain('"Custo por cor/material";"Massa (g)";"Preço (R$/kg)";"Subtotal (R$)"');
    expect(csv).toContain('"PLA · #ff0000";"12";"100";"1,20"');
  });

  it("neutralizes formula-like names and quotes delimiter and newline characters", () => {
    const maliciousChannels = [{ ...channels[0], name: '=HYPERLINK("https://bad")' }];
    const result = calculatePrintPrice(input, maliciousChannels);
    const csv = exportPrintCalculationCsv('Linha 1;Linha 2\n=1+1', input, maliciousChannels, result, new Date("2026-11-12T12:00:00.000Z"));

    expect(csv).toContain('"Cálculo";"Linha 1;Linha 2\n=1+1"');
    expect(csv).toContain('"\'=HYPERLINK(""https://bad"")"');
  });

  it("refuses to export an invalid or incomplete calculation", () => {
    const result = calculatePrintPrice({ ...input, targetMarginPercent: 100 }, channels);
    expect(() => exportPrintCalculationCsv("Cálculo", input, channels, result)).toThrow("Não há um cálculo válido para exportar.");
  });

  it("labels the target as markup when that pricing method is selected", () => {
    const markupInput = { ...input, pricingMode: "markup" as const, targetMarkupPercent: 50, targetMarginPercent: 0 };
    const result = calculatePrintPrice(markupInput, channels);
    expect(exportPrintCalculationCsv("Suporte", markupInput, channels, result)).toContain('"Markup desejado (%)";"50"');
  });
});
