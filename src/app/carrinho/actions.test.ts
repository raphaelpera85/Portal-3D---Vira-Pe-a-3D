import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));

import { removeCartItem, setCartItemQuantity } from "./actions";

const itemId = "dc4e58d6-c782-4dc5-83c1-68d08072224d";

function form(couponCode?: string) {
  const data = new FormData();
  data.set("itemId", itemId);
  data.set("quantity", "2");
  if (couponCode !== undefined) data.set("couponCode", couponCode);
  return data;
}

describe("cart item actions with coupons", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.revalidatePath.mockReset();
    mocks.redirect.mockReset().mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
    mocks.getUserWithRole.mockReset().mockResolvedValue({ supabase: { rpc: mocks.rpc }, user: { id: "buyer-user" }, authorized: true });
  });

  it("preserves and revalidates the coupon after a quantity change", async () => {
    await expect(setCartItemQuantity(form("save_10"))).rejects.toThrow("redirect:/carrinho?resultado=atualizado&cupom=SAVE_10");

    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["set_cart_item_quantity", "preview_marketplace_coupon"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/carrinho");
  });

  it("keeps the coupon visible when removal makes it invalid", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ error: name === "preview_marketplace_coupon" ? { code: "22023", message: "minimum not met" } : null }));

    await expect(removeCartItem(form("save_10"))).rejects.toThrow("redirect:/carrinho?resultado=cupom-invalido&cupom=SAVE_10");

    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["remove_cart_item", "preview_marketplace_coupon"]);
  });

  it("shows a generic error when coupon revalidation fails for another reason", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ error: name === "preview_marketplace_coupon" ? { code: "PGRST000", message: "service unavailable" } : null }));

    await expect(setCartItemQuantity(form("save_10"))).rejects.toThrow("redirect:/carrinho?resultado=erro&cupom=SAVE_10");
  });

  it("preserves the code when the cart mutation fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "database unavailable" } });

    await expect(removeCartItem(form("save_10"))).rejects.toThrow("redirect:/carrinho?resultado=erro&cupom=SAVE_10");

    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("does not preview a coupon when no code was applied", async () => {
    await expect(setCartItemQuantity(form())).rejects.toThrow("redirect:/carrinho?resultado=atualizado");

    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
