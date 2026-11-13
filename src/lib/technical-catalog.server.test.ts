import { beforeEach, describe, expect, it, vi } from "vitest";
import { materials, nozzles, printers } from "./technical-catalog";

const mocks = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { loadTechnicalCatalog } from "./technical-catalog.server";

describe("loadTechnicalCatalog", () => {
  beforeEach(() => mocks.createSupabaseServerClient.mockReset());

  it("keeps successful database rows and supplements failed catalog queries with local references", async () => {
    const rows: Record<string, { data: unknown[] | null; error: { message: string } | null }> = {
      printer_models: { data: [{ id: "database-printer", manufacturer: "Maker", model: "M1", variant: "standard", technology: "FDM" }], error: null },
      material_catalog: { data: null, error: { message: "table unavailable" } },
      nozzle_catalog: { data: [], error: null },
      printer_material_compatibility: { data: [], error: null },
      printer_nozzle_compatibility: { data: [], error: null },
    };
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: (table: string) => ({ select: () => ({ eq: async () => rows[table] }) }),
    });

    const catalog = await loadTechnicalCatalog();

    expect(catalog.source).toBe("database");
    expect(catalog.error).toContain("Combinamos os dados disponíveis");
    expect(catalog.printers.some((printer) => printer.id === "database-printer")).toBe(true);
    expect(catalog.printers.some((printer) => printer.id === "prusa-mk4s")).toBe(true);
    expect(catalog.materials).toEqual(materials);
    expect(catalog.nozzles).toEqual(nozzles);
    expect(catalog.printers.length).toBeGreaterThan(printers.length);
  });
});
