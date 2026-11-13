const carriers = ["correios", "melhor_envio", "transportadora", "retirada_local"] as const;

export function validateShippingOriginPostalCode(value: unknown) {
  if (typeof value !== "string") return null;
  const postalCode = value.trim();
  return /^\d{5}-?\d{3}$/.test(postalCode) ? postalCode.replace("-", "") : null;
}

export function validateShippingQuote(values: Record<string, unknown>) {
  const carrier = typeof values.carrier === "string" ? values.carrier : "";
  const service = typeof values.service === "string" ? values.service.trim() : "";
  const rawPrice = typeof values.price === "string" ? values.price.trim().replace(",", ".") : "";
  const deliveryDays = typeof values.deliveryDays === "string" ? Number(values.deliveryDays) : NaN;
  const localPickup = carrier === "retirada_local";
  if (!(carriers as readonly string[]).includes(carrier) || service.length < 2 || service.length > 120
    || !/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(rawPrice) || !Number.isInteger(deliveryDays)
    || (localPickup ? deliveryDays !== 0 || Number(rawPrice) !== 0 : deliveryDays < 1 || deliveryDays > 365)) return null;
  const shippingCents = Math.round(Number(rawPrice) * 100);
  if (!Number.isSafeInteger(shippingCents) || shippingCents < 0 || shippingCents > 100_000_000) return null;
  return { carrier, service, shippingCents, deliveryDays };
}

export function validateShipmentTracking(values: Record<string, unknown>) {
  const rawTrackingCode = typeof values.trackingCode === "string" ? values.trackingCode : "";
  if (/[\u0000-\u001f\u007f]/.test(rawTrackingCode)) return null;
  const trackingCode = rawTrackingCode.trim();
  const rawUrl = typeof values.trackingUrl === "string" ? values.trackingUrl.trim() : "";
  const rawExpectedDate = typeof values.expectedDate === "string" ? values.expectedDate.trim() : "";
  let trackingUrl: string | null = null;
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.port || rawUrl.length > 2048) return null;
      trackingUrl = url.toString();
    } catch { return null; }
  }
  if (!/^[^\u0000-\u001f\u007f]{1,100}$/.test(trackingCode)) return null;
  const expectedDate = rawExpectedDate ? new Date(`${rawExpectedDate}T00:00:00Z`) : null;
  if (rawExpectedDate && (!/^\d{4}-\d{2}-\d{2}$/.test(rawExpectedDate) || Number.isNaN(expectedDate?.getTime())
    || expectedDate?.toISOString().slice(0, 10) !== rawExpectedDate)) return null;
  return { trackingCode, trackingUrl, expectedDate: rawExpectedDate || null };
}
