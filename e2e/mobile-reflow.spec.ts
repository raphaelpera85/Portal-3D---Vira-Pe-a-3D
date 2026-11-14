import { expect, test } from "@playwright/test";

test("public pages reflow at a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });

  for (const path of ["/", "/modelos", "/modelos/882ecc1d8c46", "/calculadora", "/catalogos", "/visualizador", "/carrinho", "/lojas", "/designers", "/conta", "/conta/recuperar-senha"]) {
    await page.goto(path);
    await expect(page.locator("#main-content")).toBeVisible();
    const bounds = await page.locator("#main-content").evaluate((main) => {
      const viewport = window.innerWidth;
      const elements = [main, ...main.querySelectorAll("a, button, input, select, textarea, h1, h2, h3, p, label")];
      return elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return [];
        let parent = element.parentElement;
        while (parent) {
          const style = getComputedStyle(parent);
          if (["auto", "scroll"].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth) return [];
          parent = parent.parentElement;
        }
        return rect.left < -1 || rect.right > viewport + 1
          ? [{ tag: element.tagName.toLowerCase(), text: element.textContent?.trim().slice(0, 60), left: Math.round(rect.left), right: Math.round(rect.right) }]
          : [];
      });
    });
    expect(bounds, `${path} has content outside the 320px viewport`).toEqual([]);
    const documentWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(documentWidth.scroll, `${path} document exceeds the viewport width`).toBeLessThanOrEqual(documentWidth.viewport);
  }
});
