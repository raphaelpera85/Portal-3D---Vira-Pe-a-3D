import { expect, test } from "@playwright/test";

test("muted text meets WCAG AA contrast on page surfaces in both themes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("virapeca-theme", "light"));
  await page.goto("/modelos");

  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark") {
      await page.evaluate(() => localStorage.setItem("virapeca-theme", "dark"));
      await page.reload();
    }

    const ratios = await page.evaluate(() => {
      const color = (value: string) => {
        const hex = value.trim().replace(/^#/, "");
        return hex.length === 3
          ? [...hex].map((part) => Number.parseInt(part + part, 16))
          : [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
      };
      const luminance = (rgb: number[]) => {
        const channels = rgb.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const muted = luminance(color(getComputedStyle(document.documentElement).getPropertyValue("--muted")));
      return ["--paper", "--surface"].map((name) => {
        const background = luminance(color(getComputedStyle(document.documentElement).getPropertyValue(name)));
        return (Math.max(muted, background) + 0.05) / (Math.min(muted, background) + 0.05);
      });
    });

    expect(Math.min(...ratios), `${theme} theme muted text contrast`).toBeGreaterThanOrEqual(4.5);
  }
});
