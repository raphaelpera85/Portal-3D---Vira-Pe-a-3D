import { describe, expect, it } from "vitest";
import { buildSellerActivityReportRows, getSellerActivityReportWindows } from "./seller-activity-report";

describe("seller activity report", () => {
  it("uses rolling seven-day and thirty-day windows", () => {
    expect(getSellerActivityReportWindows(new Date("2026-11-12T12:00:00.000Z"))).toEqual({
      sevenDays: "2026-11-05T12:00:00.000Z",
      thirtyDays: "2026-10-13T12:00:00.000Z",
      through: "2026-11-12T12:00:00.000Z",
    });
  });

  it("totals cart orders by status and keeps incoming requests separate", () => {
    expect(buildSellerActivityReportRows({
      orders: {
        pending: { sevenDays: 2, thirtyDays: 4 },
        accepted: { sevenDays: 3, thirtyDays: 5 },
        declined: { sevenDays: 1, thirtyDays: 2 },
      },
      productQuotes: { sevenDays: 7, thirtyDays: 11 },
      productPurchases: { sevenDays: 19, thirtyDays: 23 },
      customPrints: { sevenDays: 13, thirtyDays: 17 },
    })).toEqual([
      { label: "Pedidos do carrinho", sevenDays: 6, thirtyDays: 11 },
      { label: "Aguardando decisão", sevenDays: 2, thirtyDays: 4 },
      { label: "Aceitos", sevenDays: 3, thirtyDays: 5 },
      { label: "Recusados", sevenDays: 1, thirtyDays: 2 },
      { label: "Orçamentos de produtos", sevenDays: 7, thirtyDays: 11 },
      { label: "Pedidos diretos de produtos", sevenDays: 19, thirtyDays: 23 },
      { label: "Solicitações de impressão", sevenDays: 13, thirtyDays: 17 },
    ]);
  });
});
