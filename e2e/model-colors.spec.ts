import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("public model details let keyboard users highlight parts by file color", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ path: resolve("models/beagle-tricolor.3mf") }));
  await page.goto("/modelos/ffcd1251d90c");

  const palette = page.getByRole("region", { name: "Cores do modelo" });
  const color = palette.getByRole("button").first();
  const canvas = page.locator(".viewer-stage canvas");
  await expect(color).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(color).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const before = await canvas.screenshot();
  await color.focus();
  await page.keyboard.press("Enter");
  await expect(color).toHaveAttribute("aria-pressed", "true");
  await expect(palette.getByRole("status")).toContainText("destacados");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect((await canvas.screenshot()).equals(before)).toBe(false);

  await page.keyboard.press("Enter");
  await expect(color).toHaveAttribute("aria-pressed", "false");

  await page.setViewportSize({ width: 400, height: 608 });
  await expect(color).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("color selection visibly marks only matching painted faces in a public model", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ path: resolve("models/painted.3mf") }));
  await page.goto("/modelos/ffcd1251d90c");

  const palette = page.getByRole("region", { name: "Cores do modelo" });
  const color = palette.getByRole("button").first();
  const canvas = page.locator(".viewer-stage canvas");
  await expect(color).toBeVisible();
  await expect(canvas).toBeVisible();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const before = await canvas.screenshot();

  await color.focus();
  await page.keyboard.press("Enter");
  await expect(color).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => !(await canvas.screenshot()).equals(before)).toBe(true);
});
