import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("public textured GLB preview loads its embedded texture and keeps the source download", async ({ page }) => {
  test.setTimeout(120_000);
  const textureErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Couldn't load texture/i.test(message.text())) textureErrors.push(message.text());
  });
  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ path: resolve("models/grinch-lid-topper-preview.glb") }));
  await page.goto("/modelos/grinch-tampa-texturizado");

  await expect(page.getByText(/GLB carregado/i)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".viewer-stage canvas")).toBeVisible();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(textureErrors).toEqual([]);
  await expect(page.getByRole("link", { name: "Baixar arquivo principal" })).toHaveAttribute("href", /grinch-lid-topper-textured\.zip$/);
});
