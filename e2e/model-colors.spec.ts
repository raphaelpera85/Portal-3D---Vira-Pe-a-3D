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

for (const model of [
  { name: "cat", id: "ed02512a7e12", file: "models/cat.3mf", minColors: 4 },
  { name: "owl", id: "2a2e5f6c6d90", file: "models/coruja-descanso-oculos.3mf", minColors: 4 },
  { name: "improved cat holder", id: "803903c6b264", file: "models/improved-cat-glasses-holder.3mf", minColors: 3 },
]) {
  test(`public ${model.name} glasses holder shows the real color palette`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ path: resolve(model.file) }));
    await page.goto(`/modelos/${model.id}`);

    const palette = page.getByRole("region", { name: "Cores do modelo" });
    await expect.poll(async () => palette.getByRole("button").count(), { timeout: 90_000 }).toBeGreaterThanOrEqual(model.minColors);
  });
}
