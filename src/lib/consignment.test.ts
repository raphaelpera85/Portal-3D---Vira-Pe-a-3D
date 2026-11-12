import { describe, expect, it } from "vitest";
import { summarizeConsignment, validateConsignmentInput, validateConsignmentMovement } from "./consignment";

describe("consignment validation and reporting", () => {
  it("normalizes Brazilian money and validates a consignment item", () => {
    expect(validateConsignmentInput({
      establishment: " Loja Central ", productName: "Suporte", productId: "",
      quantity: "10", unitCostBrl: "12,50", salePriceBrl: "42.90", commissionPercent: "15",
    })).toEqual({ establishment: "Loja Central", productName: "Suporte", productId: null, quantity: 10, unitCostBrl: 12.5, salePriceBrl: 42.9, commissionPercent: 15 });
  });

  it("allows a published store product to supply the saved product name", () => {
    expect(validateConsignmentInput({
      establishment: "Loja Central", productName: "", productId: "123e4567-e89b-42d3-a456-426614174000",
      quantity: "2", unitCostBrl: "10", salePriceBrl: "20", commissionPercent: "0",
    })?.productName).toBe("");
  });

  it("rejects invalid item and movement values", () => {
    expect(validateConsignmentInput({ establishment: "L", productName: "Suporte", quantity: "1.5", unitCostBrl: "2", salePriceBrl: "4", commissionPercent: "101" })).toBeNull();
    expect(validateConsignmentMovement({ movementType: "sold", quantity: "0", notes: "" })).toBeNull();
    expect(validateConsignmentMovement({ movementType: "unknown", quantity: "2", notes: "" })).toBeNull();
  });

  it("reports available stock, amounts due, commission, and estimated result", () => {
    const report = summarizeConsignment({ unitCostBrl: 12, salePriceBrl: 42.5, commissionPercent: 10 }, [
      { movementType: "delivered", quantity: 10 },
      { movementType: "sold", quantity: 4 },
      { movementType: "returned", quantity: 1 },
      { movementType: "lost", quantity: 1 },
    ]);
    expect(report).toEqual({ delivered: 10, sold: 4, returned: 1, lost: 1, inStock: 4, grossSalesCents: 17_000, commissionCents: 1_700, receivableCents: 15_300, estimatedResultCents: 9_300 });
  });
});
