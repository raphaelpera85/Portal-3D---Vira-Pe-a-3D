import { expect, test } from "@playwright/test";

test("mobile links and search controls meet the 24px target minimum", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [path, selectors] of [
    ["/modelos", [".header-cart", ".model-gallery-controls > .search-field input", ".model-gallery-copy .product-tags a"]],
    ["/visualizador", [".viewer-back-link"]],
    ["/conta", [".account-recovery-link", ".footer-policy-links a"]],
  ] as const) {
    await page.goto(path);
    for (const selector of selectors) {
      const target = page.locator(selector).first();
      await expect(target, `${path} ${selector} should be visible`).toBeVisible();
      const bounds = await target.evaluate((element) => {
        const { width, height } = element.getBoundingClientRect();
        return { width, height };
      });
      expect(bounds.width, `${path} ${selector} width`).toBeGreaterThanOrEqual(24);
      expect(bounds.height, `${path} ${selector} height`).toBeGreaterThanOrEqual(24);
    }
  }
});
