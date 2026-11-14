import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => { throw new Error(`redirect:${url}`); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: vi.fn() }));

import { saveProductCategoryAction, setProductCategoryActiveAction } from "./actions";

describe("category admin actions", () => {
  it("preserves the current list page after save validation feedback", async () => {
    const formData = new FormData();
    formData.set("pagina", "2");

    await expect(saveProductCategoryAction(formData)).rejects.toThrow(
      "redirect:/admin/categorias?resultado=erro&pagina=2",
    );
  });

  it("preserves the current list page after status validation feedback", async () => {
    const formData = new FormData();
    formData.set("pagina", "2");

    await expect(setProductCategoryActiveAction(formData)).rejects.toThrow(
      "redirect:/admin/categorias?resultado=erro&pagina=2",
    );
  });
});
