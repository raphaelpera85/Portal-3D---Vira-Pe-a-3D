import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), revalidatePath: vi.fn(), profile: null as null | Record<string, unknown>, insert: null as null | Record<string, unknown> }));

vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveMakerCalculation } from "./actions";
import { getShowcaseModel } from "@/lib/model-showcase";

const storeId = "dc4e58d6-c782-4dc5-83c1-68d08072224d";
const profileId = "76543210-abcd-4123-8123-abcdef123456";
const modelSlug = "803903c6b264";
const snapshot = JSON.stringify({
  input: {
    filamentGrams: 200, filamentPricePerKg: 100, printHours: 3, averagePowerWatts: 120,
    energyPricePerKwh: 0.8, machineCostPerHour: 4, depreciationPerHour: 2,
    maintenancePerHour: 1, laborMinutes: 30, laborRatePerHour: 24, overheadPerUnit: 1,
    failureReservePercent: 10, additionalCosts: [{ name: "Ímãs", amount: 2.5 }], targetMarginPercent: 25,
  },
  channels: [{ id: "marketplace", name: "Marketplace", feePercent: 12, fixedFee: 2 }],
  modelProfile: { id: profileId, modelSlug, name: "Nome forjado pelo navegador" },
});

function configure(ownsProfile: boolean) {
  mocks.profile = ownsProfile ? { id: profileId, model_slug: modelSlug, profile_name: "Perfil oficial" } : null;
  mocks.insert = null;
  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      insert: vi.fn((payload: Record<string, unknown>) => { mocks.insert = payload; return builder; }),
      maybeSingle: vi.fn(async () => table === "stores"
        ? { data: { id: storeId }, error: null }
        : { data: mocks.profile, error: null }),
      single: vi.fn(async () => ({ data: { id: "9abcdef0-1234-4123-8123-abcdef123456" }, error: null })),
    };
    return builder;
  });
  mocks.getUserWithRole.mockResolvedValue({ supabase: { from }, user: { id: "maker-user" }, authorized: true });
}

const form = () => {
  const value = new FormData();
  value.set("title", "Cat glasses holder");
  value.set("snapshot", snapshot);
  return value;
};

describe("saveMakerCalculation model profile provenance", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("stores the verified profile and catalog model name", async () => {
    configure(true);
    const result = await saveMakerCalculation({ message: "", success: false }, form());
    const model = getShowcaseModel(modelSlug)!;

    expect(result.success).toBe(true);
    expect(mocks.insert?.input_snapshot).toMatchObject({ modelProfile: { id: profileId, modelSlug, name: `${model.name} · Perfil oficial` } });
    expect(mocks.insert?.profile_id).toBeNull();
  });

  it("rejects a model profile that does not belong to the current maker", async () => {
    configure(false);
    const result = await saveMakerCalculation({ message: "", success: false }, form());

    expect(result.success).toBe(false);
    expect(mocks.insert).toBeNull();
  });
});
