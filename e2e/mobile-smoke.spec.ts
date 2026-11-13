import { expect, test } from "@playwright/test";

test("mobile navigation opens the model catalog and a model detail", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 608 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Modelos 3D" }).click();

  await expect(page).toHaveURL(/\/modelos$/);
  await expect(page.getByRole("heading", { name: "Modelos para inspirar." })).toBeVisible();
  const categoryNav = page.getByRole("navigation", { name: "Filtrar modelos por categoria" });
  await expect(categoryNav.getByRole("link", { name: "Chaveiros" })).toBeVisible();
  await categoryNav.getByRole("link", { name: "Chaveiros" }).click();
  await expect(page).toHaveURL(/categoria=chaveiros/);
  await expect(page.locator(".model-gallery-card").first()).toBeVisible();

  await page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await page.locator(".model-gallery-image").first().click();
  await expect(page).toHaveURL(/\/modelos\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar arquivo 3MF" })).toHaveAttribute("href", /raw\.githubusercontent\.com/);

  const layoutFitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(layoutFitsViewport).toBe(true);
});

test("mobile 3D viewer fits the viewport without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 608 });
  await page.goto("/visualizador");
  await expect(page.locator(".viewer-layout")).toBeVisible();
  await expect(page.locator(".viewer-stage")).toBeVisible();
  await expect(page.locator(".viewer-inspector")).toBeVisible();

  const layout = await page.locator(".viewer-layout").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth };
  });
  expect(layout.left).toBeGreaterThanOrEqual(-1);
  expect(layout.right).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
});
