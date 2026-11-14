import { describe, expect, it, vi } from "vitest";
import { recognizeCatalogImage, recognizeSlicerImages } from "./google-vision-ocr";

describe("Google Vision OCR adapter", () => {
  it("sends images privately to document text detection and returns plain text", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ responses: [{ fullTextAnnotation: { text: "Total filament: 20 g" } }] }), { status: 200 }));
    const result = await recognizeSlicerImages([{ content: new Uint8Array([1, 2, 3]), mimeType: "image/png" }], "server-key", fetcher);
    expect(result).toEqual(["Total filament: 20 g"]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://vision.googleapis.com/v1/images:annotate");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("server-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({ requests: [{ image: { content: "AQID" }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], imageContext: { languageHints: ["pt", "en"] } }] });
  });

  it("does not expose provider response bodies on failures", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("private provider diagnostic", { status: 429 }));
    await expect(recognizeSlicerImages([{ content: new Uint8Array([1]), mimeType: "image/jpeg" }], "server-key", fetcher)).rejects.toThrow("ocr_provider_http_429");
  });
});

describe("Google Vision catalog image recognition", () => {
  it("includes localized object names in search terms", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ responses: [{
      localizedObjectAnnotations: [{ name: "Eyeglasses" }, { name: "Cat" }],
      webDetection: { webEntities: [{ description: "Cat Glasses Holder" }] },
      labelAnnotations: [{ description: "Toy" }],
    }] }), { status: 200 }));

    const result = await recognizeCatalogImage({ content: new Uint8Array([1]), mimeType: "image/png" }, "server-key", fetcher);

    expect(result).toEqual({ terms: ["Eyeglasses", "Cat", "Cat Glasses Holder", "Toy"], query: '"Eyeglasses" OR "Cat" OR "Cat Glasses Holder" OR "Toy"' });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ requests: [{ features: expect.arrayContaining([{ type: "OBJECT_LOCALIZATION", maxResults: 5 }]) }] });
  });
});
