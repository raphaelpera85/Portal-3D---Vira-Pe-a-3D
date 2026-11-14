import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserWithRole: vi.fn(),
  recognizeSlicerImages: vi.fn(),
  consumeQuota: vi.fn(),
}));

vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/google-vision-ocr", () => ({ recognizeSlicerImages: mocks.recognizeSlicerImages }));

import { POST } from "./route";

describe("slicer OCR upload limit", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLOUD_VISION_API_KEY", "test-key");
    mocks.getUserWithRole.mockReset().mockResolvedValue({ user: { id: "maker" }, authorized: true, supabase: { rpc: mocks.consumeQuota } });
    mocks.consumeQuota.mockReset().mockResolvedValue({ data: true, error: null });
    mocks.recognizeSlicerImages.mockReset();
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
});
