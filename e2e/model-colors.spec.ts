import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("public model details let keyboard users highlight parts by file color", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ path: resolve("models/beagle-tricolor.3mf") }));
  await page.goto("/modelos/ffcd1251d90c");

  const palette = page.getByRole("region", { name: "Cores do modelo" });
  const color = palette.getByRole("button").first();
  await expect(color).toBeVisible();
  await color.focus();
  await page.keyboard.press("Enter");
  await expect(color).toHaveAttribute("aria-pressed", "true");
  await expect(palette.getByRole("status")).toContainText("destacados");

  await page.keyboard.press("Enter");
  await expect(color).toHaveAttribute("aria-pressed", "false");

  await page.setViewportSize({ width: 400, height: 608 });
  await expect(color).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
