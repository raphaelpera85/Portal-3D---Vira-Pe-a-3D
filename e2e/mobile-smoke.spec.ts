import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("keyboard skip link focuses the main content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sua ideia" })).toBeVisible();
  const skipLink = page.getByRole("link", { name: "Pular para o conteúdo principal" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page).toHaveURL(/#main-content$/);
});

test("skip link restores focus when streamed main content becomes visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sua ideia" })).toBeVisible();
  await page.locator("#main-content").evaluate((main) => {
    const target = main as HTMLElement;
    target.style.display = "none";
    window.location.hash = "#main-content";
    window.setTimeout(() => target.style.removeProperty("display"), 100);
  });
  await expect(page.locator("#main-content")).toBeFocused();
});

test("mobile navigation opens the model catalog and a model detail", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 608 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fabricantes recomendados" })).toBeVisible();
  if (await page.locator(".featured-store-empty").isVisible()) {
    await expect(page.getByRole("link", { name: "Ver todas as lojas" })).toHaveCount(0);
  }
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
  await page.getByRole("button", { name: "Buscar imagem" }).click();
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
  await expect(page.getByRole("link", { name: "Baixar arquivo principal" })).toHaveAttribute("href", /raw\.githubusercontent\.com/);

  const layoutFitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(layoutFitsViewport).toBe(true);
});

test("mobile 3D viewer fits the viewport without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 608 });
  await page.goto("/visualizador");
  await expect(page.locator(".viewer-layout")).toBeVisible();
  await expect(page.locator(".viewer-stage")).toBeVisible();
  await expect(page.locator(".viewer-inspector")).toBeVisible();
  await expect(page.getByRole("button", { name: "XYZ, alternar eixos" })).toBeVisible();
  await expect(page.locator(".viewer-upload-secondary")).toHaveCount(0);
  await expect(page.locator(".viewer-empty-inspector")).toContainText("Abra um modelo 3D");
  await expect(page.getByRole("heading", { name: "Dimensões", exact: true })).toHaveCount(0);

  const layout = await page.locator(".viewer-layout").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth };
  });
  expect(layout.left).toBeGreaterThanOrEqual(-1);
  expect(layout.right).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
});

test("viewer exposes printer, material, nozzle, and volume compatibility checks", async ({ page }) => {
  await page.goto("/visualizador");
  await page.locator(".viewer-upload-button input[type=file]").setInputFiles("models/drybox-single-v3.3mf");
  await expect(page.getByRole("heading", { name: "Dimensões", exact: true })).toBeVisible({ timeout: 60_000 });
  const printer = page.getByLabel("Impressora para verificar compatibilidade");
  await printer.selectOption({ label: "Bambu Lab A1 mini standard" });
  await expect(page.locator(".viewer-volume-value")).toContainText("180 × 180 × 180 mm");
  const material = page.getByLabel("Material para verificar compatibilidade");
  await material.selectOption({ index: 1 });
  await expect(page.locator(".viewer-volume-check")).toContainText("Material");
  await expect(page.locator(".viewer-volume-check")).toContainText("Temperatura do hotend");
  await expect(page.locator(".viewer-volume-check")).toContainText("Bico instalado");

  await printer.selectOption({ label: "Bambu Lab H2D AMS 2 Pro Combo" });
  await expect(page.getByLabel("Configuração do volume de impressão")).toBeVisible();
  await page.getByLabel("Configuração do volume de impressão").selectOption("combinedNozzleBuildVolumeMm");
  await expect(page.locator(".viewer-volume-value")).toContainText("350 × 320 × 325 mm");

  await printer.selectOption({ label: "FLSUN V400 Max standard" });
  await expect(page.locator(".viewer-volume-check")).toContainText("cilíndrico");
  await expect(page.locator(".viewer-volume-check > li").filter({ hasText: "Volume de impressão" })).toHaveClass(/status-unverified/);
});

test("viewer shows exact resin profiles and keeps unknown exposure unverified", async ({ page }) => {
  await page.goto("/visualizador");
  await page.locator(".viewer-upload-button input[type=file]").setInputFiles("models/drybox-single-v3.3mf");
  await expect(page.getByRole("heading", { name: "Dimensões", exact: true })).toBeVisible({ timeout: 60_000 });
  const printer = page.getByLabel("Impressora para verificar compatibilidade");
  const material = page.getByLabel("Material para verificar compatibilidade");
  const checks = page.locator(".viewer-volume-check > li");
  const check = (label: string) => checks.filter({ has: page.getByText(label, { exact: true }) });

  await printer.selectOption({ label: "Anycubic Photon Mono M7 standard" });
  await material.selectOption({ label: "Anycubic Standard Resin V2 · standard resin" });
  await expect(check("Material")).toHaveClass(/status-compatible/);
  await expect(check("Perfil de exposição")).toContainText("2,2 s");
  await expect(check("Perfil de exposição")).toHaveClass(/status-compatible/);

  await material.selectOption({ label: "Anycubic Water-Wash Resin 2.0 · water-washable resin" });
  await expect(check("Perfil de exposição")).toContainText("2,5 s");
  await expect(check("Perfil de exposição")).toContainText("35 s por 4 camadas");

  await printer.selectOption({ label: "ELEGOO Saturn 4 Ultra 12K" });
  await material.selectOption({ label: "ELEGOO ABS-Like Resin V3.0 · ABS-like resin" });
  await expect(check("Material")).toHaveClass(/status-compatible/);
  await expect(check("Comprimento de onda UV")).toHaveClass(/status-compatible/);
  await expect(check("Perfil de exposição")).toHaveClass(/status-unverified/);
});

test("technical catalog asks visitors to sign in", async ({ page }) => {
  await page.goto("/catalogos");
  await expect(page).toHaveURL(/\/conta(?:\?|$)/);
});
