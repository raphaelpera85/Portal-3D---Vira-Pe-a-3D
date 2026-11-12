export type CouponDiscount = { code: string; discount_percent_bps: number | null; discount_fixed_cents: number | null };
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_HUNDRED = BigInt(100);
const BIGINT_TEN_THOUSAND = BigInt(10_000);

export function normalizeCouponCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code) ? code : null;
}

export function validateCouponDefinition(input: { code: unknown; type: unknown; value: unknown }) {
  const code = normalizeCouponCode(input.code);
  if (!code || (input.type !== "percent" && input.type !== "fixed") || typeof input.value !== "string") return null;
  const value = input.value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const centsOrBasisPoints = BigInt(whole) * BIGINT_HUNDRED + BigInt(fraction.padEnd(2, "0"));
  if (centsOrBasisPoints < BIGINT_ONE || centsOrBasisPoints > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  if (input.type === "percent") {
    return centsOrBasisPoints < BIGINT_TEN_THOUSAND ? { code, type: "percent" as const, discount_percent_bps: Number(centsOrBasisPoints), discount_fixed_cents: null } : null;
  }
  return { code, type: "fixed" as const, discount_percent_bps: null, discount_fixed_cents: Number(centsOrBasisPoints) };
}

export function calculateCouponDiscountCents(subtotalCents: number, storeCount: number, coupon: CouponDiscount) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0 || !Number.isInteger(storeCount) || storeCount < 1) return 0;
  const maximumDiscount = subtotalCents - storeCount;
  if (maximumDiscount < 1) return 0;
  if (coupon.discount_percent_bps !== null) {
    if (!Number.isInteger(coupon.discount_percent_bps) || coupon.discount_percent_bps < 1 || coupon.discount_percent_bps > 9999) return 0;
    return Math.min(Number(BigInt(subtotalCents) * BigInt(coupon.discount_percent_bps) / BIGINT_TEN_THOUSAND), maximumDiscount);
  }
  if (!Number.isSafeInteger(coupon.discount_fixed_cents) || Number(coupon.discount_fixed_cents) < 1) return 0;
  return Math.min(Number(coupon.discount_fixed_cents), maximumDiscount);
}

export function allocateCouponDiscountCents(rows: Array<{ key: string; subtotalCents: number }>, discountCents: number) {
  if (!Number.isSafeInteger(discountCents) || discountCents < 0 || rows.some((row) => !row.key || !Number.isSafeInteger(row.subtotalCents) || row.subtotalCents < 1)
    || new Set(rows.map((row) => row.key)).size !== rows.length) throw new RangeError("Invalid coupon allocation");
  const capacities = rows.map((row) => ({ ...row, capacity: row.subtotalCents - 1 }));
  const totalCapacity = capacities.reduce((total, row) => total + BigInt(Math.max(0, row.capacity)), BIGINT_ZERO);
  const discount = BigInt(discountCents);
  if (discount > totalCapacity) throw new RangeError("Invalid coupon allocation");
  if (totalCapacity === BIGINT_ZERO) return Object.fromEntries(rows.map(({ key }) => [key, 0]));
  const shares = capacities.map((row, index) => {
    const capacity = BigInt(Math.max(0, row.capacity));
    const numerator = discount * capacity;
    return { key: row.key, index, cents: numerator / totalCapacity, remainder: numerator % totalCapacity };
  });
  let remaining = discount - shares.reduce((total, share) => total + share.cents, BIGINT_ZERO);
  const ranked = [...shares].sort((a, b) => a.remainder === b.remainder ? a.key < b.key ? -1 : a.key > b.key ? 1 : 0 : a.remainder > b.remainder ? -1 : 1);
  for (const share of ranked) {
    if (remaining === BIGINT_ZERO) break;
    shares[share.index].cents += BIGINT_ONE;
    remaining -= BIGINT_ONE;
  }
  return Object.fromEntries(shares.map(({ key, cents }) => [key, Number(cents)]));
}
