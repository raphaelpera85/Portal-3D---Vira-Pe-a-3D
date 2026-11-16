import { expect, test } from "@playwright/test";

test("account forms show focus rings during keyboard navigation", async ({ page }) => {
  await page.goto("/conta");

  const loginEmail = page.getByLabel("E-mail").first();
  await loginEmail.click();
  await expect(loginEmail).toBeFocused();
  const loginPassword = page.getByLabel("Senha").first();
  await page.keyboard.press("Tab");
  await expect(loginPassword).toBeFocused();
  await expect.poll(() => loginPassword.evaluate((input) => getComputedStyle(input).outlineStyle)).toBe("solid");

  const confirmation = page.getByLabel("Confirme sua senha");
  const registrationPassword = page.getByLabel(/Crie uma senha/);
  await registrationPassword.click();
  await expect(registrationPassword).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmation).toBeFocused();
  await expect.poll(() => confirmation.evaluate((input) => getComputedStyle(input).outlineStyle)).toBe("solid");

  for (const link of await page.locator(".auth-legal-note a").all()) {
    await expect.poll(() => link.evaluate((element) => getComputedStyle(element).textDecorationLine)).toContain("underline");
  }
});
