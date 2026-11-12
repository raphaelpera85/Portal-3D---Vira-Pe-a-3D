import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("saved theme bootstrap", () => {
  it("applies the saved theme before the page hydrates", () => {
    expect(layout).toMatch(/<Script[^>]*strategy="beforeInteractive"/);
    expect(layout).toContain('localStorage.getItem("virapeca-theme")');
    expect(layout).toContain("document.documentElement.dataset.theme");
  });
});
