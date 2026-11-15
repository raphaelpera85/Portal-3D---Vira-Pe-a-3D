import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));

import { suggestPrinterModelAction } from "./actions";

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    manufacturer: "Bambu Lab", model: "A1 Mini", variant: "standard", technology: "FDM",
    sourceUrl: "https://example.com/a1-mini", notes: "  Modelo solicitado.  ", ...values,
  })) data.set(key, value);
  return data;
}

describe("suggestPrinterModelAction", () => {
  const storeQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  const rpc = vi.fn();

  beforeEach(() => {
    storeQuery.select.mockReset().mockReturnValue(storeQuery);
    storeQuery.eq.mockReset().mockReturnValue(storeQuery);
    storeQuery.maybeSingle.mockReset().mockResolvedValue({ data: { id: "store-1" } });
    rpc.mockReset().mockResolvedValue({ error: null });
    mocks.getUserWithRole.mockReset().mockResolvedValue({
      supabase: { from: vi.fn(() => storeQuery), rpc }, user: { id: "maker-1" }, authorized: true,
    });
    mocks.revalidatePath.mockReset();
  });

  it("submits validated printer details for the maker's store", async () => {
    await expect(suggestPrinterModelAction(form())).rejects.toThrow(
      "redirect:/painel/maker?resultado=modelo-sugerido#equipamentos",
    );

    expect(storeQuery.eq).toHaveBeenCalledWith("owner_user_id", "maker-1");
    expect(rpc).toHaveBeenCalledWith("submit_printer_model_suggestion", {
      p_manufacturer: "Bambu Lab", p_model: "A1 Mini", p_variant: "standard", p_technology: "FDM",
      p_source_url: "https://example.com/a1-mini", p_notes: "Modelo solicitado.",
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/painel/maker"], ["/admin/catalogos/impressoras"]]);
  });

  it("rejects malformed input before checking the maker session", async () => {
    await expect(suggestPrinterModelAction(form({ sourceUrl: "javascript:alert(1)" }))).rejects.toThrow(
      "redirect:/painel/maker?resultado=modelo-sugestao-erro#equipamentos",
    );

    expect(mocks.getUserWithRole).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not submit when the authorized maker has no store", async () => {
    storeQuery.maybeSingle.mockResolvedValue({ data: null });

    await expect(suggestPrinterModelAction(form())).rejects.toThrow(
      "redirect:/painel/maker?resultado=modelo-sugestao-erro#equipamentos",
    );

    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "23505", message: "duplicate" }, "modelo-sugestao-duplicada"],
    [{ code: "P0001", message: "SUGGESTION_PENDING_LIMIT reached" }, "modelo-sugestao-limite"],
  ])("shows the specific result for database rejection", async (error, result) => {
    rpc.mockResolvedValue({ error });

    await expect(suggestPrinterModelAction(form())).rejects.toThrow(
      `redirect:/painel/maker?resultado=${result}#equipamentos`,
    );

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
