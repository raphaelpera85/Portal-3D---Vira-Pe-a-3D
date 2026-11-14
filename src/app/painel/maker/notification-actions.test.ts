import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));

import { markCustomPrintTargetRead, markQuoteRequestNotificationRead, markSellerOrderNotificationRead } from "./actions";

const id = "dc4e58d6-c782-4dc5-83c1-68d08072224d";
const actions = [
  ["pedido de orçamento", markQuoteRequestNotificationRead, "requestId", "update"],
  ["impressão personalizada", markCustomPrintTargetRead, "targetId", "rpc"],
  ["compra pelo carrinho", markSellerOrderNotificationRead, "orderId", "rpc"],
] as const;

function form(field: string) {
  const data = new FormData();
  data.set(field, id);
  return data;
}

describe.each(actions)("aviso de $0", (_name, action, field, operation) => {
  const updateResult = vi.fn();
  const updateChain = { update: vi.fn(), eq: vi.fn(), is: updateResult };
  const rpc = vi.fn();
  const from = vi.fn(() => updateChain);

  beforeEach(() => {
    mocks.getUserWithRole.mockReset().mockResolvedValue({ supabase: { from, rpc }, user: { id: "maker-user" }, authorized: true });
    mocks.revalidatePath.mockReset();
    mocks.redirect.mockReset().mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
    updateResult.mockReset().mockResolvedValue({ error: null });
    updateChain.update.mockReset().mockReturnValue(updateChain);
    updateChain.eq.mockReset().mockReturnValue(updateChain);
    rpc.mockReset().mockResolvedValue({ error: null });
    from.mockClear();
  });

  it("revalida o painel após marcar como lido", async () => {
    await action(form(field));

    expect(operation === "update" ? updateResult : rpc).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/painel/maker");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("mostra falha do banco e mantém o aviso na tela", async () => {
    const failure = { message: "database unavailable" };
    if (operation === "update") updateResult.mockResolvedValue({ error: failure });
    else rpc.mockResolvedValue({ error: failure });

    await expect(action(form(field))).rejects.toThrow("redirect:/painel/maker?resultado=notificacao-lida-erro#notificacoes");

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
