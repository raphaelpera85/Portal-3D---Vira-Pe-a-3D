import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => { throw new Error(`redirect:${url}`); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: vi.fn() }));
vi.mock("@/lib/mercado-pago-access-token.server", () => ({ getMercadoPagoSellerAccessToken: vi.fn() }));
vi.mock("@/lib/mercado-pago-payments", () => ({ mapMercadoPagoOrderStatus: vi.fn() }));
vi.mock("@/lib/mercado-pago-refunds", () => ({ parseRefundAmountCents: vi.fn(), prepareMercadoPagoRefund: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

import { refundSellerOrderPayment } from "./actions";

describe("refundSellerOrderPayment", () => {
  it("returns to the current valid ledger page after validation feedback", async () => {
    const formData = new FormData();
    formData.set("pagina", "3");

    await expect(refundSellerOrderPayment(formData)).rejects.toThrow(
      "redirect:/painel/maker/financeiro?resultado=reembolso-dados-invalidos&pagina=3",
    );
  });
});
