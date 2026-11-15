import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));

import { createProductDraft } from "./actions";

const userId = "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7";
const storeId = "dc4e58d6-c782-4dc5-83c1-68d08072224d";
const creatorModelId = "4d06021fc27c";

function productForm() {
  const form = new FormData();
  form.set("name", "Suporte de mesa");
  form.set("categoryId", storeId);
  form.set("listingType", "physical");
  form.set("priceMode", "quote");
  form.set("fulfillmentMode", "quote");
  form.set("storeId", storeId);
  form.set("modelSlug", creatorModelId);
  return form;
}

function setup(publishedModel: Record<string, unknown> | null) {
  const insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "product-1" }, error: null }) })) }));
  const filters = vi.fn();
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => {
      const query = {
        eq: vi.fn((column: string, value: string) => { filters(column, value); return query; }),
        maybeSingle: vi.fn().mockResolvedValue(table === "stores"
          ? { data: { id: storeId }, error: null }
          : { data: publishedModel, error: null }),
      };
      return query;
    }),
    insert,
  }));
  mocks.getUserWithRole.mockResolvedValue({ supabase: { from }, user: { id: userId }, authorized: true });
  return { from, insert, filters };
}

describe("maker product model previews", () => {
  beforeEach(() => mocks.getUserWithRole.mockReset());

  it("accepts only a published model owned by the maker's store", async () => {
    const { from, insert, filters } = setup({ id: creatorModelId });

    const result = await createProductDraft({ message: "", success: false }, productForm());

    expect(result.success).toBe(true);
    expect(from).toHaveBeenCalledWith("creator_model_submissions");
    expect(filters).toHaveBeenCalledWith("store_id", storeId);
    expect(filters).toHaveBeenCalledWith("submitted_by", userId);
    expect(filters).toHaveBeenCalledWith("review_status", "published");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      product_properties: expect.objectContaining({ model_preview_id: creatorModelId }),
    }));
  });

  it("rejects a model that is not published or owned by this maker", async () => {
    const { insert } = setup(null);

    const result = await createProductDraft({ message: "", success: false }, productForm());

    expect(result.success).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
