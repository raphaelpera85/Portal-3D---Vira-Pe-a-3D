import { expect, test } from "@playwright/test";

test("mobile catalog searches by an uploaded preview and opens a matching model", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/modelos");

  const previewSrc = await page.locator(".model-gallery-image img").first().getAttribute("src");
  expect(previewSrc).toBeTruthy();
  const previewUrl = new URL(previewSrc!, page.url());
  const previewPath = previewUrl.pathname === "/_next/image" ? previewUrl.searchParams.get("url") : previewUrl.pathname;
  expect(previewPath).toBeTruthy();
  const response = await request.get(new URL(previewPath!, page.url()).toString());
  expect(response.ok()).toBe(true);

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator(".catalog-image-file").click(),
  ]);
  await fileChooser.setFiles({ name: "referencia.png", mimeType: "image/png", buffer: await response.body() });
  await expect(page.locator(".catalog-image-selected")).toContainText("referencia.png");
  await page.getByRole("button", { name: "Buscar imagem" }).click();

  const results = page.locator(".catalog-image-results");
  await expect(results).toContainText("Prévias mais parecidas");
  await results.locator("li a").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/modelos\/[a-z0-9-]+$/);
});
