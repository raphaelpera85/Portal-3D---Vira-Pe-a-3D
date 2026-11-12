import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recognizeCatalogImage: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  consumeQuota: vi.fn(),
}));

vi.mock("@/lib/google-vision-ocr", () => ({ recognizeCatalogImage: mocks.recognizeCatalogImage }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/ocr-image-validation", () => ({ MAX_SLICER_OCR_IMAGE_BYTES: 2 * 1024 * 1024, validateSlicerOcrImages: () => null }));

import { POST } from "./route";

const pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

function request(consent?: string) {
  const form = new FormData();
  form.set("image", new File([pngSignature], "model.png", { type: "image/png" }));
  if (consent) form.set("consent", consent);
  return new Request("https://virapeca3d.example/api/catalog/image-search", { method: "POST", body: form });
}

describe("catalog image search consent", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLOUD_VISION_API_KEY", "test-key");
    mocks.consumeQuota.mockReset().mockResolvedValue({ data: true, error: null });
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue({ rpc: mocks.consumeQuota });
    mocks.recognizeCatalogImage.mockReset().mockResolvedValue({ terms: ["cat"], query: '"cat"' });
  });

  it("rejects requests without explicit consent before charging quota or sending the image", async () => {
    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "image_search_consent_required" });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.recognizeCatalogImage).not.toHaveBeenCalled();
  });
});
