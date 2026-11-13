import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { loadMakerConsignmentItems } from "./maker-consignment-report.server";

describe("maker consignment report data loading", () => {
  it("pages through the maker's store lots and links their movements", async () => {
    const lots = Array.from({ length: 501 }, (_, index) => ({ id: `lot-${index}`, establishment: "Loja", product_name: "Produto", unit_cost_brl: 1, sale_price_brl: 2, commission_percent: 0, commission_fixed_fee_brl: 0, created_at: "2026-11-13T00:00:00Z" }));
    const itemScopes: Array<[string, string]> = [];
    const movementBatches: string[][] = [];
    const supabase = {
      from: (table: string) => {
        let ids: string[] = [];
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn((column: string, value: string) => { itemScopes.push([column, value]); return query; }),
          in: vi.fn((_column: string, values: string[]) => { ids = values; movementBatches.push(values); return query; }),
          order: vi.fn(() => query),
          range: vi.fn(async (from: number, to: number) => {
            if (table === "maker_consignment_items") return { data: lots.slice(from, to + 1), error: null };
            return { data: from === 0 && ids.includes("lot-500") ? [{ item_id: "lot-500", movement_type: "sold", quantity: 1 }] : [], error: null };
          }),
        };
        return query;
      },
    };

    const result = await loadMakerConsignmentItems(supabase, "store-1");

    expect(result.error).toBe(false);
    expect(result.items).toHaveLength(501);
    expect(result.items[500].movements).toEqual([{ item_id: "lot-500", movement_type: "sold", quantity: 1 }]);
    expect(itemScopes).toEqual([["store_id", "store-1"], ["store_id", "store-1"]]);
    expect(movementBatches).toHaveLength(6);
  });
});
