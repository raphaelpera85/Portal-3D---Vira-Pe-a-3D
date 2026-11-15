import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  getUserWithRole: vi.fn(),
  recognizeSlicerImages: vi.fn(),
  consumeQuota: vi.fn(),
}));

vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/google-vision-ocr", () => ({ recognizeSlicerImages: mocks.recognizeSlicerImages }));

import { POST } from "./route";

const pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

function request(consent?: string) {
  const form = new FormData();
  form.set("images", new File([pngSignature], "slicer.png", { type: "image/png" }));
  if (consent) form.set("consent", consent);
  return new Request("https://virapeca3d.example/api/ocr/slicer", { method: "POST", body: form });
}

function requestWithScreenshotFixture() {
  const screenshot = readFileSync(new URL("../../../../lib/fixtures/anycubic-slicer-next-filament-panel.png", import.meta.url));
  const form = new FormData();
  form.set("images", new File([new Uint8Array(screenshot)], "anycubic-panel.png", { type: "image/png" }));
  form.set("consent", "yes");
  return { request: new Request("https://virapeca3d.example/api/ocr/slicer", { method: "POST", body: form }), screenshot };
}

const anycubicOcrText = readFileSync(new URL("../../../../lib/fixtures/anycubic-slicer-next-filament-panel.txt", import.meta.url), "utf8");

function requestWithImageCount(count: number) {
  const form = new FormData();
  for (let index = 0; index < count; index++) form.append("images", new File([pngSignature], `slicer-${index + 1}.png`, { type: "image/png" }));
  form.set("consent", "yes");
  return new Request("https://virapeca3d.example/api/ocr/slicer", { method: "POST", body: form });
}

describe("slicer OCR upload limit", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLOUD_VISION_API_KEY", "test-key");
    mocks.getUserWithRole.mockReset().mockResolvedValue({ user: { id: "maker" }, authorized: true, supabase: { rpc: mocks.consumeQuota } });
    mocks.consumeQuota.mockReset().mockResolvedValue({ data: true, error: null });
    mocks.recognizeSlicerImages.mockReset();
  });

  it("rejects image processing without explicit consent before quota or provider calls", async () => {
    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "ocr_consent_required" });
    expect(mocks.getUserWithRole).toHaveBeenCalledWith(["maker", "designer"]);
    expect(mocks.consumeQuota).not.toHaveBeenCalled();
    expect(mocks.recognizeSlicerImages).not.toHaveBeenCalled();
  });

  it("rejects an oversized streamed body before parsing or charging quota", async () => {
    const body = new Blob([new ArrayBuffer(Math.floor(4.25 * 1024 * 1024) + 1)]);
    const request = new Request("https://virapeca3d.example/api/ocr/slicer", {
      method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body,
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "images_too_large" });
    expect(mocks.consumeQuota).not.toHaveBeenCalled();
    expect(mocks.recognizeSlicerImages).not.toHaveBeenCalled();
  });

  it("reads multiple slicer images together and charges quota by image count", async () => {
    mocks.recognizeSlicerImages.mockResolvedValue([
      "Anycubic Slicer Next\nModel\n211,63 g",
      "Anycubic Slicer Next\nSupports\n12,17 g",
    ]);

    const response = await POST(requestWithImageCount(2));

    expect(response.status).toBe(200);
    expect(mocks.consumeQuota).toHaveBeenCalledWith("consume_maker_slicer_ocr_quota", { p_image_count: 2 });
    expect(mocks.recognizeSlicerImages).toHaveBeenCalledWith([
      { content: pngSignature, mimeType: "image/png" },
      { content: pngSignature, mimeType: "image/png" },
    ], "test-key");
    expect((await response.json()).extraction).toMatchObject({ slicer: "Anycubic Slicer Next", modelGrams: 211.63, supportGrams: 12.17 });
  });

  it("accepts the real Anycubic screenshot fixture and parses its OCR response", async () => {
    mocks.recognizeSlicerImages.mockResolvedValue([anycubicOcrText]);
    const { request: screenshotRequest, screenshot } = requestWithScreenshotFixture();

    const response = await POST(screenshotRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.recognizeSlicerImages).toHaveBeenCalledWith([
      { content: expect.any(Uint8Array), mimeType: "image/png" },
    ], "test-key");
    expect(mocks.recognizeSlicerImages.mock.calls[0][0][0].content).toEqual(new Uint8Array(screenshot));
    expect(result.extraction).toMatchObject({
      slicer: "Anycubic Slicer Next", totalGrams: 359.88, modelGrams: 61.36, supportGrams: 40.35,
      purgeGrams: 216.33, wipeTowerGrams: 41.84, lengthMeters: 121.64, printHours: 21 + 54 / 60,
      filamentChanges: 1018,
    });
    expect(result.extraction.filaments).toContainEqual(expect.objectContaining({ index: 5, grams: 42.82, lengthMeters: 14.47 }));
  });
});
