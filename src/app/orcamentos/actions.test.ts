import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));

import { cancelSellerPurchaseOrder } from "./actions";

const orderId = "dc4e58d6-c782-4dc5-83c1-68d08072224d";

function form(confirm = true) {
  const data = new FormData();
  data.set("orderId", orderId);
  if (confirm) data.set("confirmCancel", "yes");
  return data;
}

describe("cancelSellerPurchaseOrder", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.revalidatePath.mockReset();
    mocks.redirect.mockReset().mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
    mocks.getUserWithRole.mockReset().mockResolvedValue({ supabase: { rpc: mocks.rpc }, user: { id: "buyer-user" }, authorized: true });
  });

  it("cancels the order through the guarded database function", async () => {
    await expect(cancelSellerPurchaseOrder(form())).rejects.toThrow("redirect:/orcamentos?resultado=pedido-cancelado");

    expect(mocks.rpc).toHaveBeenCalledWith("cancel_seller_purchase_order", { p_order_id: orderId });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orcamentos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/painel/maker");
  });

  it("requires explicit confirmation", async () => {
    await expect(cancelSellerPurchaseOrder(form(false))).rejects.toThrow("redirect:/orcamentos?resultado=cancelamento-dados-invalidos");

    expect(mocks.getUserWithRole).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps the order open when database rules reject cancellation", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "payment already pending" } });

    await expect(cancelSellerPurchaseOrder(form())).rejects.toThrow("redirect:/orcamentos?resultado=cancelamento-indisponivel");

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
