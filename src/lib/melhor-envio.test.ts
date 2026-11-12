import { describe, expect, it } from "vitest";
import { normalizeMelhorEnvioRates } from "./melhor-envio";

describe("normalizeMelhorEnvioRates", () => {
  it("keeps valid customized prices, drops unavailable services, and sorts by price", () => {
    expect(normalizeMelhorEnvioRates([
      { id: 2, name: "Expresso", company: { name: "Transportadora B" }, custom_price: "19.90", custom_delivery_time: 2 },
      { id: 1, name: "Econômico", company: { name: "Transportadora A" }, custom_price: "12.50", custom_delivery_time: 5 },
      { id: 3, name: "Indisponível", company: { name: "Transportadora C" }, custom_price: "0", custom_delivery_time: 0, error: "Unavailable" },
    ])).toEqual([
      { id: 1, name: "Transportadora A · Econômico", company: "Transportadora A", price: 12.5, deliveryDays: 5 },
      { id: 2, name: "Transportadora B · Expresso", company: "Transportadora B", price: 19.9, deliveryDays: 2 },
    ]);
  });

  it("drops service IDs that cannot be used for a shipment", () => {
    expect(normalizeMelhorEnvioRates([
      { id: 0, name: "Invalid", company: { name: "Carrier" }, custom_price: "1", custom_delivery_time: 1 },
      { id: 1.5, name: "Invalid", company: { name: "Carrier" }, custom_price: "1", custom_delivery_time: 1 },
    ])).toEqual([]);
  });
});
