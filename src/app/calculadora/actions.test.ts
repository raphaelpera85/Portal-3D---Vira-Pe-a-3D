import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), revalidatePath: vi.fn(), product: null as null | Record<string, unknown>, updatePayload: null as null | Record<string, unknown>, updateFilters: {} as Record<string, unknown>, rpc: vi.fn(), from: vi.fn() }));

vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { applyCalculatedProductPrice } from "./actions";

const productId = "6eabced2-85c7-45fd-9c5a-946c530ab502";
const variantId = "d9a6fcd3-2467-4f27-9ff3-92c85e0fa663";
const storeId = "dc4e58d6-c782-4dc5-83c1-68d08072224d";
const makerId = "maker-user";
const form = (fields: Record<string, string>) => {
  const value = new FormData();
  for (const [key, entry] of Object.entries(fields)) value.set(key, entry);
  return value;
};

function configureMaker(product = {}) {
  mocks.product = {
    id: productId, store_id: storeId, created_by: makerId, listing_type: "physical", price_mode: "fixed",
    price_brl: "30.00", catalog_status: "published", product_properties: { variant_options: {} }, slug: "suporte",
    ...product,
  };
  const from = vi.fn((table: string) => {
    let operation = "select";
    const filters: Record<string, unknown> = {};
    const builder = {
      select: vi.fn(() => builder),
      update: vi.fn((payload: Record<string, unknown>) => { operation = "update"; mocks.updatePayload = payload; return builder; }),
      eq: vi.fn((key: string, value: unknown) => { filters[key] = value; return builder; }),
      maybeSingle: vi.fn(async () => {
        if (table === "stores") return { data: { id: storeId, slug: "loja-maker" }, error: null };
        if (operation === "update") {
          mocks.updateFilters = filters;
          return { data: { id: productId }, error: null };
        }
        const row = mocks.product;
        return { data: filters.store_id && filters.store_id !== row?.store_id ? null : row, error: null };
      }),
    };
    return builder;
  });
  mocks.from = from;
  mocks.rpc.mockReset().mockResolvedValue({ error: null });
  mocks.getUserWithRole.mockResolvedValue({ supabase: { from, rpc: mocks.rpc }, user: { id: makerId }, authorized: true });
  mocks.updatePayload = null;
  mocks.updateFilters = {};
}

function configureVariantMaker(variantPrice = "42.50") {
  configureMaker({ product_properties: { variant_options: { Cor: ["Azul", "Preto"] } } });
  const variantFrom = vi.fn(() => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: { id: variantId, price_brl: variantPrice }, error: null })),
    };
    return builder;
  });
  mocks.getUserWithRole.mockResolvedValueOnce({
    supabase: { from: (table: string) => table === "marketplace_product_variants" ? variantFrom() : mocks.from(table), rpc: mocks.rpc },
    user: { id: makerId }, authorized: true,
  });
}

describe("applyCalculatedProductPrice", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("updates an owned fixed-price product only if its saved price has not changed", async () => {
    configureMaker();

    const result = await applyCalculatedProductPrice({ message: "", success: false }, form({
      productId, priceCents: "4590", expectedPriceCents: "3000", confirmedPublishedPrice: "yes",
    }));

    expect(result).toEqual({ success: true, message: "Preço atualizado no anúncio." });
    expect(mocks.updatePayload).toMatchObject({ price_brl: 45.9 });
    expect(mocks.updateFilters).toMatchObject({ id: productId, store_id: storeId, created_by: makerId, price_brl: "30.00" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/produtos/suporte");
  });

  it("rejects products with variants or digital fulfillment", async () => {
    configureMaker({ product_properties: { variant_options: { Cor: ["Azul", "Preto"] } } });
    const variant = await applyCalculatedProductPrice({ message: "", success: false }, form({ productId, priceCents: "4590", expectedPriceCents: "3000", confirmedPublishedPrice: "yes" }));
    expect(variant.success).toBe(false);
    expect(mocks.updatePayload).toBeNull();

    configureMaker({ listing_type: "digital" });
    const digital = await applyCalculatedProductPrice({ message: "", success: false }, form({ productId, priceCents: "4590", expectedPriceCents: "3000", confirmedPublishedPrice: "yes" }));
    expect(digital.success).toBe(false);
    expect(mocks.updatePayload).toBeNull();
  });

  it("updates an owned product variant through the atomic price RPC", async () => {
    configureVariantMaker();
    const result = await applyCalculatedProductPrice({ message: "", success: false }, form({
      productId, variantId, priceCents: "4590", expectedPriceCents: "4250", confirmedPublishedPrice: "yes",
    }));

    expect(result).toEqual({ success: true, message: "Preço da variação atualizado no anúncio." });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_calculated_product_variant_price", {
      p_product_id: productId, p_variant_id: variantId, p_expected_price_cents: 4250, p_price_cents: 4590,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/produtos/suporte");
  });

  it("refuses stale variant prices and reports reservations without changing them", async () => {
    configureVariantMaker();
    const stale = await applyCalculatedProductPrice({ message: "", success: false }, form({
      productId, variantId, priceCents: "4590", expectedPriceCents: "4200", confirmedPublishedPrice: "yes",
    }));
    expect(stale.message).toContain("preço da variação mudou");
    expect(mocks.rpc).not.toHaveBeenCalled();

    configureVariantMaker();
    mocks.rpc.mockResolvedValueOnce({ error: { message: "VARIANT_RESERVED" } });
    const reserved = await applyCalculatedProductPrice({ message: "", success: false }, form({
      productId, variantId, priceCents: "4590", expectedPriceCents: "4250", confirmedPublishedPrice: "yes",
    }));
    expect(reserved.message).toContain("reservada em um pagamento pendente");
  });

  it("refuses stale product prices and unauthenticated updates", async () => {
    configureMaker();
    const unconfirmed = await applyCalculatedProductPrice({ message: "", success: false }, form({
      productId, priceCents: "4590", expectedPriceCents: "3000",
    }));
    expect(unconfirmed.success).toBe(false);
    expect(mocks.updatePayload).toBeNull();

    const stale = await applyCalculatedProductPrice({ message: "", success: false }, form({ productId, priceCents: "4590", expectedPriceCents: "2999", confirmedPublishedPrice: "yes" }));
    expect(stale.success).toBe(false);
    expect(mocks.updatePayload).toBeNull();

    mocks.getUserWithRole.mockResolvedValue({ supabase: null, user: null, authorized: false });
    const unauthorized = await applyCalculatedProductPrice({ message: "", success: false }, form({ productId, priceCents: "4590", expectedPriceCents: "3000", confirmedPublishedPrice: "yes" }));
    expect(unauthorized.success).toBe(false);
  });

  it("never updates a product from another store", async () => {
    configureMaker({ store_id: "another-store" });
    const result = await applyCalculatedProductPrice({ message: "", success: false }, form({
      productId, priceCents: "4590", expectedPriceCents: "3000", confirmedPublishedPrice: "yes",
    }));

    expect(result.success).toBe(false);
    expect(mocks.updatePayload).toBeNull();
  });
});
