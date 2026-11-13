import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261113095008_add_bambu_a1_ams_lite_combo.sql", import.meta.url), "utf8");

describe("Bambu Lab A1 Combo migration", () => {
  it("records the documented AMS lite variant and copies the A1 hotend compatibility", () => {
    expect(migration).toContain("'Bambu Lab', 'A1', 'Combo', 'FDM', 'published'");
    expect(migration).toContain("'AMS lite', 4");
    expect(migration).toContain('"supportedNozzleDiametersMm":[0.2,0.4,0.6,0.8]');
    expect(migration).toContain("combo.source_url, date '2026-11-13', 'published'");
    expect(migration).toContain("compatibility.printer_id = standard.id");
    expect(migration).toContain("on conflict (printer_id, nozzle_id) do update");
  });
});
