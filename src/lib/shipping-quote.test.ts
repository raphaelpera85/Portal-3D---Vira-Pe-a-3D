import { describe, expect, it } from "vitest";
import { validateShipmentTracking, validateShippingOriginPostalCode, validateShippingQuote } from "./shipping-quote";

describe("validateShippingOriginPostalCode", () => {
  it("normalizes a Brazilian CEP and rejects malformed input", () => {
    expect(validateShippingOriginPostalCode("01310-100")).toBe("01310100");
    expect(validateShippingOriginPostalCode(" 01310100 ")).toBe("01310100");
    expect(validateShippingOriginPostalCode("1310-100")).toBeNull();
    expect(validateShippingOriginPostalCode(null)).toBeNull();
  });
});

describe("validateShippingQuote", () => {
  it("normalizes a seller-provided carrier rate into integer cents", () => {
    expect(validateShippingQuote({ carrier: "correios", service: "PAC", price: "24,90", deliveryDays: "7" }))
      .toEqual({ carrier: "correios", service: "PAC", shippingCents: 2_490, deliveryDays: 7 });
  });

  it.each([
    { carrier: "unknown", service: "PAC", price: "10", deliveryDays: "5" },
    { carrier: "correios", service: "", price: "10", deliveryDays: "5" },
    { carrier: "correios", service: "PAC", price: "-1", deliveryDays: "5" },
    { carrier: "correios", service: "PAC", price: "10.999", deliveryDays: "5" },
    { carrier: "correios", service: "PAC", price: "1e2", deliveryDays: "5" },
    { carrier: "correios", service: "PAC", price: "10", deliveryDays: "0" },
  ])("rejects invalid rate input %#", (input) => {
    expect(validateShippingQuote(input)).toBeNull();
  });
});

describe("validateShipmentTracking", () => {
  it("accepts a carrier tracking code and safe HTTPS URL", () => {
    expect(validateShipmentTracking({ trackingCode: "AB123456789BR", trackingUrl: "https://rastreamento.example/AB123456789BR", expectedDate: "2027-01-10" }))
      .toEqual({ trackingCode: "AB123456789BR", trackingUrl: "https://rastreamento.example/AB123456789BR", expectedDate: "2027-01-10" });
  });

  it("rejects malformed dates and unsafe tracking URLs", () => {
    expect(validateShipmentTracking({ trackingCode: "AB123", trackingUrl: "http://rastreamento.example/AB123" })).toBeNull();
    expect(validateShipmentTracking({ trackingCode: "AB123", trackingUrl: "https://user@rastreamento.example/AB123" })).toBeNull();
    expect(validateShipmentTracking({ trackingCode: "AB123", trackingUrl: "https://rastreamento.example:8443/AB123" })).toBeNull();
    expect(validateShipmentTracking({ trackingCode: "AB123", expectedDate: "2027-02-30" })).toBeNull();
    expect(validateShipmentTracking({ trackingCode: "\nAB123" })).toBeNull();
  });
});
