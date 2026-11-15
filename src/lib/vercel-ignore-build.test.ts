import { describe, expect, it } from "vitest";
import { shouldBuildForChangedFiles } from "../../scripts/vercel-ignore-build.mjs";

describe("Vercel ignored build step", () => {
  it("skips test and fixture changes without skipping runtime code", () => {
    expect(shouldBuildForChangedFiles([
      "src/lib/example.test.ts", "src/lib/example.spec.tsx", "src/lib/fixtures/example.png",
      "scripts/example.test.mjs", "supabase/tests/example.sql", "docs/example.md",
    ])).toBe(false);
    expect(shouldBuildForChangedFiles(["src/app/page.tsx"])).toBe(true);
    expect(shouldBuildForChangedFiles(["scripts/generate-model-asset-manifest.mjs"])).toBe(true);
    expect(shouldBuildForChangedFiles(["vercel.json"])).toBe(true);
  });
});
