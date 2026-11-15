import { expect, test } from "@playwright/test";

test("account forms keep visible focus indicators on editable labels", async ({ page }) => {
  await page.goto("/conta");

  const loginEmail = page.getByLabel("E-mail").first();
  await loginEmail.focus();
  await expect.poll(() => loginEmail.evaluate((input) => getComputedStyle(input).outlineStyle)).toBe("solid");

  const confirmation = page.getByLabel("Confirme sua senha");
  await confirmation.focus();
  await expect.poll(() => confirmation.evaluate((input) => getComputedStyle(input).outlineStyle)).toBe("solid");
});
