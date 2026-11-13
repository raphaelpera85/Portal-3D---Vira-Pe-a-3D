import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113014036_expand_official_material_catalog.sql", import.meta.url), "utf8");

describe("official material catalog expansion", () => {
  it("adds TPU, PETG carbon fiber, and PC Blend with official references", () => {
    for (const product of ["Prusament TPU 95A", "Prusament PETG Carbon Fiber", "Prusament PC Blend"]) {
      expect(migration).toContain(product);
    }
    expect(migration.match(/https:\/\/prusament\.com\/materials\/[^']+/g)).toHaveLength(4);
    expect(migration).toContain("'TPU', 'filament', 'published'");
    expect(migration).toContain("'PETG-CF', 'filament', 'published'");
    expect(migration).toContain("'PC', 'filament', 'published'");
  });

  it("keeps undocumented equipment and drying requirements unknown", () => {
    expect(migration).toMatch(/1\.75, null, true, null, 255, 275, 80, 100, null, null/);
    expect(migration).toMatch(/1\.75, 1\.22, false, null, 265, 285, 100, 120, false, 200/);
    expect(migration).toContain('"requiresHardenedNozzle":true');
    expect(migration).toContain('"heatedBedRequired":true');
  });
});
