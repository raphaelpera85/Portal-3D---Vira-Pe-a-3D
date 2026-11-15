import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const couponMigration = readFileSync(new URL("../../supabase/migrations/20261112161122_marketplace_coupons.sql", import.meta.url), "utf8");
const paymentAction = readFileSync(new URL("../app/orcamentos/payment-actions.ts", import.meta.url), "utf8");

describe("marketplace coupon checkout", () => {
  it("stores each seller's quoted discount on the order", () => {
    expect(couponMigration).toContain("quoted_store_discounts jsonb := '{}'::jsonb");
    expect(couponMigration).toContain("seller_discount := coalesce((quoted_store_discounts ->> seller.id::text)::bigint, 0)");
    expect(couponMigration).toContain("quoted_coupon_code, seller_discount");
    expect(couponMigration).toContain("from public.get_marketplace_coupon_quote(cart_key, normalized_coupon)");
  });

  it("charges and calculates marketplace commission after the seller-funded discount", () => {
    expect(couponMigration).toContain("discounted_subtotal_cents := subtotal_cents - order_row.coupon_discount_cents");
    expect(couponMigration).toContain("calculated_total := discounted_subtotal_cents + order_row.shipping_cost_cents");
    expect(couponMigration).toContain("p_marketplace_fee_cents >= discounted_subtotal_cents");
    expect(paymentAction).toContain("const payableSubtotalCents = subtotalCents - couponDiscountCents");
    expect(paymentAction).toContain("calculateMarketplaceFeeCents(payableSubtotalCents, feePercent)");
  });

  it("keeps payment creation behind the server service role", () => {
    expect(couponMigration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(couponMigration).toContain("Service role required");
  });

  it("limits order creation to the buyer's own address and cart", () => {
    expect(couponMigration).toContain("r.role = 'buyer'::public.app_role");
    expect(couponMigration).toContain("a.buyer_id = (select auth.uid()) for share");
    expect(couponMigration).toContain("c.buyer_id = (select auth.uid()) for update");
  });

  it("queues seller notifications and requires WhatsApp opt-in", () => {
    expect(couponMigration).toContain("insert into public.store_notification_deliveries");
    expect(couponMigration).toContain("select new_order, 'email', c.email");
    expect(couponMigration).toContain("select new_order, 'whatsapp', c.whatsapp");
    expect(couponMigration).toContain("c.whatsapp_opt_in");
  });
});
