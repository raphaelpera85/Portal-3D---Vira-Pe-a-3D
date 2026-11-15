import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));

import { reviewPrinterModelSuggestionAction } from "./actions";

const suggestionId = "3d877d8d-f44c-4894-9dc2-3e73091e0052";

function form(decision: string, suggestion = suggestionId) {
  const data = new FormData();
  data.set("suggestionId", suggestion);
  data.set("decision", decision);
  data.set("note", "  Revisada pela equipe.  ");
  data.set("pagina", "2");
  data.set("sugestaoPagina", "3");
  return data;
}

describe("reviewPrinterModelSuggestionAction", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset().mockResolvedValue({ supabase: { rpc: mocks.rpc }, user: { id: "admin-1" }, authorized: true });
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.revalidatePath.mockReset();
  });

  it.each([["approve", "sugestao-aprovada"], ["reject", "sugestao-recusada"]])("records a %s decision and preserves both queue pages", async (decision, result) => {
    await expect(reviewPrinterModelSuggestionAction(form(decision)))
      .rejects.toThrow(`redirect:/admin/catalogos/impressoras?resultado=${result}&pagina=2&sugestaoPagina=3`);

    expect(mocks.getUserWithRole).toHaveBeenCalledWith("admin");
    expect(mocks.rpc).toHaveBeenCalledWith("review_printer_model_suggestion", {
      p_suggestion_id: suggestionId, p_decision: decision, p_note: "Revisada pela equipe.",
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/admin/catalogos/impressoras"], ["/painel/maker"], ["/catalogos"]]);
  });

  it("rejects invalid decisions before checking the administrator session", async () => {
    await expect(reviewPrinterModelSuggestionAction(form("publish")))
      .rejects.toThrow("redirect:/admin/catalogos/impressoras?resultado=erro&pagina=2&sugestaoPagina=3");

    expect(mocks.getUserWithRole).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps a pending suggestion visible when another reviewer already handled it", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Suggestion is no longer pending" } });

    await expect(reviewPrinterModelSuggestionAction(form("approve")))
      .rejects.toThrow("redirect:/admin/catalogos/impressoras?resultado=sugestao-analisada&pagina=2&sugestaoPagina=3");

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not call the review RPC without an authorized administrator", async () => {
    mocks.getUserWithRole.mockResolvedValue({ supabase: null, user: null, authorized: false });

    await expect(reviewPrinterModelSuggestionAction(form("reject"))).rejects.toThrow("redirect:/conta");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
