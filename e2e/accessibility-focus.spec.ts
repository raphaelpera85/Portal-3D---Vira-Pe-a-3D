import { expect, test } from "@playwright/test";

test("calculator keeps visible focus indicators on editable labels", async ({ page }) => {
  await page.goto("/calculadora");
  await page.getByRole("button", { name: "Adicionar item" }).click();

  const componentName = page.getByPlaceholder("Ex.: ímãs");
  await componentName.focus();
  await expect.poll(() => componentName.evaluate((input) => getComputedStyle(input.parentElement!).outlineStyle)).toBe("solid");

  const channelName = page.locator(".price-channel-row > label > input").first();
  await channelName.focus();
  await expect.poll(() => channelName.evaluate((input) => getComputedStyle(input.parentElement!).outlineStyle)).toBe("solid");
});
