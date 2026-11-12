import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("keyboard focus styles", () => {
  it("shows focus on the complete product search field", () => {
    expect(css).toMatch(/\.search-field:focus-within\s*\{[^}]*outline:\s*3px solid var\(--brand\)/);
  });

  it("keeps the closing call-to-action outline visible against its brand background", () => {
    expect(css).toMatch(/\.button-light:focus-visible\s*\{[^}]*outline-color:\s*var\(--on-brand\)/);
  });
});
