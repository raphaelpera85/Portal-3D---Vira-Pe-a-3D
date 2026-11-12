import { describe, expect, it } from "vitest";
import { makeDesignerSlug, validateDesignerProfile } from "./designer-profile";

describe("designer profile validation", () => {
  const valid = { displayName: "Ateliê 3D", biography: "Desenvolvo miniaturas e objetos funcionais, com foco em modelagem paramétrica e fabricação digital.", portfolioUrl: "https://portfolio.example", city: "São Paulo", stateCode: "sp", specialties: "Miniaturas, Modelagem paramétrica" };

  it("normalizes a useful portfolio profile", () => {
    expect(validateDesignerProfile(valid)).toEqual({
      displayName: "Ateliê 3D", biography: valid.biography, portfolioUrl: "https://portfolio.example/",
      city: "São Paulo", stateCode: "SP", specialties: ["Miniaturas", "Modelagem paramétrica"],
    });
    expect(makeDesignerSlug("Ateliê São José", "a1b2c3d4")).toBe("atelie-sao-jose-a1b2c3d4");
  });

  it.each([
    { ...valid, displayName: "A" },
    { ...valid, biography: "Muito curto." },
    { ...valid, portfolioUrl: "http://portfolio.example" },
    { ...valid, portfolioUrl: "https://user:pass@portfolio.example" },
    { ...valid, stateCode: "SPX" },
    { ...valid, specialties: "" },
    { ...valid, specialties: "AB, AB, AB, AB, AB, AB, AB, AB, AB" },
  ])("rejects invalid profile input %#", (input) => {
    expect(validateDesignerProfile(input)).toBeNull();
  });
});
