import { describe, expect, it } from "vitest";
import { allocateCouponDiscountCents, calculateCouponDiscountCents, normalizeCouponCode, validateCouponDefinition } from "./coupon";

describe("marketplace coupon rules", () => {
  it("normalizes codes and validates fixed or percent values without floating point money", () => {
    expect(normalizeCouponCode("  feira-10 ")).toBe("FEIRA-10");
    expect(normalizeCouponCode("a!")).toBeNull();
    expect(validateCouponDefinition({ code: "feira", type: "percent", value: "12,5" })).toMatchObject({ discount_percent_bps: 1250 });
    expect(validateCouponDefinition({ code: "feira", type: "fixed", value: "20,01" })).toMatchObject({ discount_fixed_cents: 2001 });
    expect(validateCouponDefinition({ code: "feira", type: "percent", value: "100" })).toBeNull();
  });

  it("caps discounts so every seller order retains at least one cent", () => {
    const percent = calculateCouponDiscountCents(10_001, 2, { code: "METADE", discount_percent_bps: 5000, discount_fixed_cents: null });
    const fixed = calculateCouponDiscountCents(10_001, 2, { code: "FIXO", discount_percent_bps: null, discount_fixed_cents: 99_999 });
    expect(percent).toBe(5_000);
    expect(fixed).toBe(9_999);
  });

  it("allocates every cent proportionally and deterministically across sellers", () => {
    const rows = [{ key: "loja-b", subtotalCents: 700 }, { key: "loja-a", subtotalCents: 300 }];
    const allocation = allocateCouponDiscountCents(rows, 101);
    expect(allocation).toEqual({ "loja-b": 71, "loja-a": 30 });
    expect(Object.values(allocation).reduce((total, cents) => total + cents, 0)).toBe(101);
    expect(allocateCouponDiscountCents(rows, 101)).toEqual(allocation);
  });
});
