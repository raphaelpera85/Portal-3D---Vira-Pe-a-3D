export type BrazilianPostalAddress = {
  street: string;
  district: string;
  city: string;
  stateCode: string;
};

export async function lookupBrazilianPostalCode(postalCode: string): Promise<BrazilianPostalAddress | null> {
  const digits = postalCode.replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return null;

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) throw new Error("postal code lookup failed");

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid postal code response");
  const address = data as Record<string, unknown>;
  if (address.erro === true) return null;

  return {
    street: typeof address.logradouro === "string" ? address.logradouro : "",
    district: typeof address.bairro === "string" ? address.bairro : "",
    city: typeof address.localidade === "string" ? address.localidade : "",
    stateCode: typeof address.uf === "string" ? address.uf : "",
  };
}
