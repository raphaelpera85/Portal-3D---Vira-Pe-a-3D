import { describe, expect, it } from "vitest";
import { getMakerOrderActionHref } from "./maker-order-navigation";

describe("getMakerOrderActionHref", () => {
  it("returns the updated order and action result to the maker panel", () => {
    expect(getMakerOrderActionHref("pedido-aceito", "550e8400-e29b-41d4-a716-446655440000"))
      .toBe("/painel/maker?resultado=pedido-aceito&pedido=550e8400-e29b-41d4-a716-446655440000#pedidos");
  });

  it("does not add malformed order ids to the return URL", () => {
    expect(getMakerOrderActionHref("frete-erro", "not-an-id")).toBe("/painel/maker?resultado=frete-erro#pedidos");
  });
});
