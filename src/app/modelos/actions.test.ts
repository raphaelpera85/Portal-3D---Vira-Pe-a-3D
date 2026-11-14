import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn(), rows: [] as Record<string, unknown>[], queryError: null as null | { message: string } }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { loadVisibleModelPrintProfiles } from "./actions";

const metrics = {
  slicer: "OrcaSlicer", modelGrams: null, supportGrams: null, totalGrams: 20, purgeGrams: null, wipeTowerGrams: null,
  filamentGrams: 20, derivedMass: false, lengthMeters: 5, printHours: 2, filamentChanges: null, estimatedCost: null,
  estimatedCostCurrency: null, materials: ["PLA"], conflicts: [],
  filaments: [{ index: 1, grams: 20, lengthMeters: 5, pricePerKg: null, material: "PLA", color: "#336699" }],
};
const modelSlug = "803903c6b264";
const profileId = "76543210-abcd-4123-8123-abcdef123456";

function configure() {
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), in: vi.fn(() => builder), order: vi.fn(() => builder),
    limit: vi.fn(async () => ({ data: mocks.rows, error: mocks.queryError })),
  };
  const from = vi.fn(() => builder);
  mocks.createSupabaseServerClient.mockResolvedValue({ from });
  return { builder, from };
}

describe("loadVisibleModelPrintProfiles", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.rows = [{ id: profileId, profile_name: "PLA detalhado", profile_type: "detailed", slicer: "OrcaSlicer", printer_snapshot: "Printer", material_snapshot: "PLA", nozzle_snapshot: "0.4 mm", layer_height_mm: 0.2, infill_percent: 20, wall_count: 3, supports: false, orientation: "", scale_percent: 100, quantity: 1, slicer_metrics: { ...metrics, privateText: "omit" }, sharing_scope: "community", review_status: "published" }];
    mocks.queryError = null;
  });

  it("loads only visible profiles for a known catalog model and validates their metrics", async () => {
    const { builder, from } = configure();
    const result = await loadVisibleModelPrintProfiles(modelSlug);

    expect(from).toHaveBeenCalledWith("visible_model_print_profiles");
    expect(builder.in).toHaveBeenCalledWith("model_slug", [modelSlug, "ed02512a7e12"]);
    expect(builder.limit).toHaveBeenCalledWith(100);
    expect(result.error).toBe(false);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]).toMatchObject({ id: profileId, profile_name: "PLA detalhado", metrics: { filamentGrams: 20 } });
    expect(JSON.stringify(result.profiles[0])).not.toContain("privateText");
  });

  it("rejects unknown model IDs and reports unavailable profile storage", async () => {
    const invalid = await loadVisibleModelPrintProfiles("../private");
    expect(invalid).toEqual({ profiles: [], error: true });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();

    mocks.createSupabaseServerClient.mockResolvedValue(null);
    await expect(loadVisibleModelPrintProfiles(modelSlug)).resolves.toEqual({ profiles: [], error: true });
  });
});
