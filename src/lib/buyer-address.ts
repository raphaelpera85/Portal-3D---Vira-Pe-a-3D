export type BuyerAddressInput = {
  id: string | null; label: string; recipientName: string; postalCode: string; street: string;
  number: string; complement: string; district: string; city: string; stateCode: string; reference: string; isDefault: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isBuyerAddressId = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value);
const getText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const inRange = (value: string, min: number, max: number) => value.length >= min && value.length <= max;

export function validateBuyerAddress(values: Record<string, unknown>): BuyerAddressInput | null {
  const rawId = getText(values.id);
  const id = rawId || null;
  const label = getText(values.label);
  const recipientName = getText(values.recipientName);
  const rawPostalCode = getText(values.postalCode);
  const street = getText(values.street);
  const number = getText(values.number);
  const complement = getText(values.complement);
  const district = getText(values.district);
  const city = getText(values.city);
  const stateCode = getText(values.stateCode).toUpperCase();
  const reference = getText(values.reference);

  if ((id && !uuidPattern.test(id)) || !inRange(label, 2, 40) || !inRange(recipientName, 2, 100)
    || !/^\d{5}-?\d{3}$/.test(rawPostalCode) || !inRange(street, 2, 120) || !inRange(number, 1, 20)
    || complement.length > 100 || !inRange(district, 2, 100) || !inRange(city, 2, 100)
    || !/^[A-Z]{2}$/.test(stateCode) || reference.length > 200) return null;

  return {
    id, label, recipientName, postalCode: rawPostalCode.replace("-", ""), street, number, complement,
    district, city, stateCode, reference,
    isDefault: values.isDefault === true || values.isDefault === "on" || values.isDefault === "true",
  };
}
