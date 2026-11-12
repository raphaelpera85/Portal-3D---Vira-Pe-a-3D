export type MelhorEnvioRate = { id: number; name: string; company: string; price: number; deliveryDays: number };

export function normalizeMelhorEnvioRates(payload: unknown): MelhorEnvioRate[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item): MelhorEnvioRate[] => {
    if (!item || typeof item !== "object") return [];
    const rate = item as Record<string, unknown>;
    const company = rate.company && typeof rate.company === "object" ? (rate.company as Record<string, unknown>).name : null;
    const price = Number(rate.custom_price);
    const deliveryDays = Number(rate.custom_delivery_time);
    if (rate.error || !Number.isSafeInteger(Number(rate.id)) || typeof rate.name !== "string"
      || typeof company !== "string" || !Number.isFinite(price) || price < 0
      || !Number.isSafeInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) return [];
    return [{ id: Number(rate.id), name: `${company} · ${rate.name}`.slice(0, 120), company, price, deliveryDays }];
  }).sort((a, b) => a.price - b.price || a.deliveryDays - b.deliveryDays);
}
