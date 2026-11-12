export type MelhorEnvioRate = { id: number; name: string; company: string; price: number; deliveryDays: number };
export const melhorEnvioLabelScopes = ["cart-write", "cart-read", "shipping-checkout", "shipping-generate", "shipping-print", "shipping-tracking"] as const;

export type MelhorEnvioSender = {
  sender_name: string; sender_email: string; sender_phone: string; sender_document: string;
  sender_state_register: string; sender_street: string; sender_number: string; sender_complement: string;
  sender_district: string; sender_city: string; sender_state_code: string;
};

function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^([0-9])\1+$/.test(value)) return false;
  const digits = [...value].map(Number);
  const first = (digits.slice(0, 9).reduce((sum, digit, i) => sum + digit * (10 - i), 0) * 10) % 11 % 10;
  const second = (digits.slice(0, 10).reduce((sum, digit, i) => sum + digit * (11 - i), 0) * 10) % 11 % 10;
  return digits[9] === first && digits[10] === second;
}

function validCnpj(value: string) {
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value) || /^([A-Z0-9])\1+$/.test(value)) return false;
  const calculate = (base: string, weights: number[]) => {
    const sum = [...base].reduce((total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return value.endsWith(`${first}${second}`);
}

function validNfeKey(value: string) {
  if (!/^\d{44}$/.test(value) || /^([0-9])\1+$/.test(value)) return false;
  const sum = [...value.slice(0, 43)].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 8 + 2), 0);
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;
  return Number(value[43]) === checkDigit;
}

export function validateMelhorEnvioSender(values: Record<string, FormDataEntryValue | null>) {
  const read = (key: string) => typeof values[key] === "string" ? (values[key] as string).trim() : "";
  const digits = (key: string) => read(key).replace(/\D/g, "");
  const name = read("senderName");
  const email = read("senderEmail").toLowerCase();
  const phone = digits("senderPhone");
  const document = read("senderDocument").replace(/[.\-/\s]/g, "").toUpperCase();
  const stateRegister = read("senderStateRegister");
  const street = read("senderStreet");
  const number = read("senderNumber");
  const complement = read("senderComplement");
  const district = read("senderDistrict");
  const city = read("senderCity");
  const stateCode = read("senderStateCode").toUpperCase();
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || !/^\d{10,13}$/.test(phone) || !(validCpf(document) || validCnpj(document)) || stateRegister.length > 30
    || street.length < 2 || street.length > 120 || number.length < 1 || number.length > 20 || complement.length > 100
    || district.length < 2 || district.length > 100 || city.length < 2 || city.length > 100 || !/^[A-Z]{2}$/.test(stateCode)) return null;
  return {
    sender_name: name, sender_email: email, sender_phone: phone, sender_document: document,
    sender_state_register: stateRegister || "ISENTO", sender_street: street, sender_number: number,
    sender_complement: complement, sender_district: district, sender_city: city, sender_state_code: stateCode,
  } satisfies MelhorEnvioSender;
}

export function validateMelhorEnvioShipment(values: Record<string, FormDataEntryValue | null>) {
  const read = (key: string) => typeof values[key] === "string" ? (values[key] as string).trim() : "";
  const digits = (key: string) => read(key).replace(/\D/g, "");
  const invoiceKey = digits("invoiceKey");
  const recipientPhone = digits("recipientPhone");
  const recipientDocument = digits("recipientDocument");
  const widthCm = Number(read("packageWidthCm"));
  const heightCm = Number(read("packageHeightCm"));
  const lengthCm = Number(read("packageLengthCm"));
  const weightKg = Number(read("packageWeightKg"));
  if (!validNfeKey(invoiceKey) || !/^\d{10,13}$/.test(recipientPhone) || !validCpf(recipientDocument)
    || ![widthCm, heightCm, lengthCm].every((n) => Number.isFinite(n) && n >= 1 && n <= 1000)
    || !Number.isFinite(weightKg) || weightKg < 0.01 || weightKg > 30000) return null;
  return { invoiceKey, recipientPhone, recipientDocument, widthCm, heightCm, lengthCm, weightKg };
}

export function normalizeMelhorEnvioRates(payload: unknown): MelhorEnvioRate[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item): MelhorEnvioRate[] => {
    if (!item || typeof item !== "object") return [];
    const rate = item as Record<string, unknown>;
    const company = rate.company && typeof rate.company === "object" ? (rate.company as Record<string, unknown>).name : null;
    const price = Number(rate.custom_price);
    const deliveryDays = Number(rate.custom_delivery_time);
    if (rate.error || !Number.isSafeInteger(Number(rate.id)) || Number(rate.id) < 1 || typeof rate.name !== "string"
      || typeof company !== "string" || !Number.isFinite(price) || price < 0
      || !Number.isSafeInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) return [];
    return [{ id: Number(rate.id), name: `${company} · ${rate.name}`.slice(0, 120), company, price, deliveryDays }];
  }).sort((a, b) => a.price - b.price || a.deliveryDays - b.deliveryDays);
}
