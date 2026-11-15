import { expect, test } from "@playwright/test";

test("visitors are sent to sign in before opening private tools", async ({ page }) => {
  for (const route of ["/catalogos", "/calculadora", "/admin/integracoes"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/conta(?:\?|$)/);
  }
});

test("creator tools are not shown in the visitor navigation", async ({ page }) => {
  await page.goto("/modelos");

  await expect(page.locator('nav[aria-label="Navegação principal"] a[href="/catalogos"]')).toHaveCount(0);
  await expect(page.locator('nav[aria-label="Navegação principal"] a[href="/calculadora"]')).toHaveCount(0);
});

test("account form confirms new passwords and remembers the signed-in session", async ({ page }) => {
  await page.goto("/conta");

  await expect(page.getByLabel("Confirme sua senha")).toBeVisible();
  await expect(page.getByLabel("Lembrar de mim neste dispositivo")).toBeChecked();
});
