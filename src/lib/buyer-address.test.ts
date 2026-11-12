import { describe, expect, it } from "vitest";
import { isBuyerAddressId, validateBuyerAddress } from "./buyer-address";

const address = {
  label: "Casa", recipientName: "Raphael Lima", postalCode: "01310-100", street: "Avenida Paulista",
  number: "1000", complement: "Apto 42", district: "Bela Vista", city: "São Paulo", stateCode: "sp",
  reference: "Portaria principal", isDefault: "on",
};

describe("validateBuyerAddress", () => {
  it("normalizes CEP and UF before saving", () => {
    expect(validateBuyerAddress(address)).toEqual({
      id: null, label: "Casa", recipientName: "Raphael Lima", postalCode: "01310100", street: "Avenida Paulista",
      number: "1000", complement: "Apto 42", district: "Bela Vista", city: "São Paulo", stateCode: "SP",
      reference: "Portaria principal", isDefault: true,
    });
  });

  it("rejects malformed CEPs, states and address IDs", () => {
    expect(validateBuyerAddress({ ...address, postalCode: "1234" })).toBeNull();
    expect(validateBuyerAddress({ ...address, stateCode: "Sao Paulo" })).toBeNull();
    expect(validateBuyerAddress({ ...address, id: "not-a-uuid" })).toBeNull();
  });
});

describe("isBuyerAddressId", () => {
  it("accepts only UUID address references", () => {
    expect(isBuyerAddressId("8f14e45f-ea6d-4e1d-8f8a-3f2a6f1d2c70")).toBe(true);
    expect(isBuyerAddressId("other-buyer's-address")).toBe(false);
    expect(isBuyerAddressId(null)).toBe(false);
  });
});
