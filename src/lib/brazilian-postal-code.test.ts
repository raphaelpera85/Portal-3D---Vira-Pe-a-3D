import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupBrazilianPostalCode } from "./brazilian-postal-code";

describe("lookupBrazilianPostalCode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("looks up an 8-digit CEP and maps address fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupBrazilianPostalCode("01001-000")).resolves.toEqual({
      street: "Praça da Sé", district: "Sé", city: "São Paulo", stateCode: "SP",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://viacep.com.br/ws/01001000/json/", { signal: expect.any(AbortSignal) });
  });

  it("does not query for an invalid CEP", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupBrazilianPostalCode("12345")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no address when ViaCEP does not find the CEP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: true }), {
      status: 200, headers: { "content-type": "application/json" },
    })));

    await expect(lookupBrazilianPostalCode("99999-999")).resolves.toBeNull();
  });
});
