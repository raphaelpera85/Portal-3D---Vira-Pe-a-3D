import { describe, expect, it } from "vitest";
import { applyPostalCodeAddress } from "./postal-code-address-form";

describe("applyPostalCodeAddress", () => {
  it("fills matching fields and preserves fields the user edited", () => {
    const fields = new Map([
      ["senderStreet", { value: "", dataset: {} }],
      ["senderDistrict", { value: "Meu bairro", dataset: { manual: "true" } }],
      ["senderCity", { value: "", dataset: {} }],
      ["senderStateCode", { value: "", dataset: {} }],
    ]);
    const form = { elements: { namedItem: (name: string) => fields.get(name) ?? null } } as unknown as HTMLFormElement;

    applyPostalCodeAddress(form, { street: "Rua A", district: "Centro", city: "Santos", stateCode: "SP" }, {
      street: "senderStreet", district: "senderDistrict", city: "senderCity", stateCode: "senderStateCode",
    });

    expect([...fields.values()].map(({ value }) => value)).toEqual(["Rua A", "Meu bairro", "Santos", "SP"]);
  });
});
