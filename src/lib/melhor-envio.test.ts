import { describe, expect, it } from "vitest";
import { normalizeMelhorEnvioRates, validateMelhorEnvioPackage, validateMelhorEnvioShipment } from "./melhor-envio";

const shipmentFields = {
  recipientPhone: "(11) 91234-5678",
  recipientDocument: "529.982.247-25",
  packageWidthCm: "10",
  packageHeightCm: "12",
  packageLengthCm: "15",
  packageWeightKg: "0.5",
};

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

describe("validateMelhorEnvioShipment", () => {
  it("accepts a valid model 55 invoice key and normalizes buyer and package data", () => {
    expect(validateMelhorEnvioShipment({ ...shipmentFields, invoiceKey: "35261112345678000199550010000000011000000012" })).toEqual({
      invoiceKey: "35261112345678000199550010000000011000000012", recipientPhone: "11912345678", recipientDocument: "52998224725",
      widthCm: 10, heightCm: 12, lengthCm: 15, weightKg: 0.5,
    });
  });

  it("rejects an NFC-e model 65 key even when its check digit is valid", () => {
    expect(validateMelhorEnvioShipment({ ...shipmentFields, invoiceKey: "35261112345678000199650010000000011000000015" })).toBeNull();
  });
});

describe("validateMelhorEnvioPackage", () => {
  it("accepts and normalizes a package for a custom print quote", () => {
    expect(validateMelhorEnvioPackage({ packageWidthCm: "12,5", packageHeightCm: "10", packageLengthCm: "20", packageWeightKg: "0,75" }))
      .toEqual({ widthCm: 12.5, heightCm: 10, lengthCm: 20, weightKg: 0.75 });
  });

  it("rejects zero or out-of-range package measurements", () => {
    expect(validateMelhorEnvioPackage({ packageWidthCm: "0", packageHeightCm: "10", packageLengthCm: "20", packageWeightKg: "0.75" })).toBeNull();
    expect(validateMelhorEnvioPackage({ packageWidthCm: "12", packageHeightCm: "10", packageLengthCm: "20", packageWeightKg: "30001" })).toBeNull();
  });
});
