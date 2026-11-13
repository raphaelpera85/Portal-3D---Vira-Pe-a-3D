import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("mobile navigation opens the model catalog and a model detail", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 608 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fabricantes recomendados" })).toBeVisible();
  const menuButton = page.locator(".menu-button");
  await expect(menuButton).toHaveAttribute("aria-controls", "primary-navigation");
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Explorar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();
  await menuButton.click();
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Modelos 3D" }).click();

  await expect(page).toHaveURL(/\/modelos$/);
  await expect(page.getByRole("heading", { name: "Modelos para inspirar." })).toBeVisible();
  await page.locator(".catalog-image-file input[type=file]").setInputFiles(resolve("public/modelos/65efab07f3fd.png"));
  await page.getByRole("button", { name: "Comparar com prévias" }).click();
  await expect(page.locator(".catalog-image-results")).toContainText("Prévias mais parecidas");
  await expect(page.locator(".catalog-image-results")).toContainText("capivara final");

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

test("technical catalog shows Flashforge AD5X conditions after selecting it", async ({ page }) => {
  await page.goto("/catalogos");

  const printer = page.getByLabel("Fabricante, modelo e variante");
  await printer.selectOption({ label: "Bambu Lab · A1 · standard" });
  await expect(page.locator(".technical-facts").first()).toContainText("256 × 256 × 256 mm");
  await expect(page.locator(".technical-facts").first()).toContainText("deslocamento do cabeçote");

  await printer.selectOption({ label: "Bambu Lab · A1 · Combo" });
  await expect(page.locator(".technical-facts").first()).toContainText("AMS lite · até 4 filamentos");

  await printer.selectOption({ label: "Bambu Lab · A1 mini · standard" });
  await expect(page.locator(".technical-facts").first()).toContainText("180 × 180 × 180 mm");

  await printer.selectOption({ label: "Anycubic · Photon Mono M7 · standard" });
  await expect(page.locator(".technical-panel").nth(2)).toContainText("Processo de cura");

  await printer.selectOption({ label: "Flashforge · AD5X · standard" });
  await expect(page.locator(".technical-panel").nth(2)).toContainText("Diâmetros cadastrados");
  await expect(page.locator(".technical-panel").first()).toContainText("Filamentos citados pelo fabricante:");
  await expect(page.locator(".technical-panel").first()).toContainText("TPU 95A: 0,4/0,6/0,8 mm; não compatível com IFS");
  await expect(page.locator(".technical-panel").first()).toContainText("A Flashforge informa que o TPU 95A deve ser impresso em modo de cor única");

  await page.getByRole("button", { name: "0,6 mm" }).click();
  await expect(page.locator(".technical-panel").nth(2)).toContainText("Aço endurecido indicado para filamentos abrasivos");
});
