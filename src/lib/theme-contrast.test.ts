import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
}

function token(block: string, name: string) {
  return block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
}

function luminance(color: string) {
  const channels = color.match(/[a-f\d]{2}/gi)!.map((part) => parseInt(part, 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("brand theme contrast", () => {
  it("keeps brand surfaces readable in light and dark themes", () => {
    const themes = [rule(":root"), rule(':root[data-theme="dark"]')];

    for (const theme of themes) {
      const foreground = token(theme, "--on-brand");
      const background = token(theme, "--brand");
      const onWhite = token(theme, "--on-white");
      const mutedStrong = token(theme, "--muted-strong");
      const surface = token(theme, "--surface");
      expect(foreground).toBeDefined();
      expect(background).toBeDefined();
      expect(onWhite).toBeDefined();
      expect(mutedStrong).toBeDefined();
      expect(surface).toBeDefined();
      expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(onWhite!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mutedStrong!, surface!)).toBeGreaterThanOrEqual(4.5);
    }

    for (const selector of [".button-primary", ".maker-mark", ".closing-panel", ".closing-panel .eyebrow", ".closing-panel > div > p:last-child"]) {
      expect(rule(selector)).toMatch(/color:\s*var\(--on-brand\)/);
    }
    expect(rule(".button-light")).toMatch(/color:\s*var\(--on-white\)/);
    for (const selector of [".trust-inner", ".maker-copy > p:not(.eyebrow)", ".maker-aside p", ".product-index"]) {
      expect(rule(selector)).toMatch(/color:\s*var\(--muted-strong\)/);
    }
  });
});
