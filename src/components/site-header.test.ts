import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./site-header.tsx", import.meta.url), "utf8");

describe("mobile navigation order", () => {
  it("moves keyboard focus into the mobile menu when it opens", () => {
    expect(source.indexOf("className={`main-nav")).toBeLessThan(source.indexOf('className="header-actions"'));
    expect(source).toMatch(/if \(menuOpen\) firstMenuLinkRef\.current\?\.focus\(\)/);
    expect(source).toMatch(/function closeMenu\(\)[\s\S]*?menuButtonRef\.current\?\.focus\(\)/);
  });
});
