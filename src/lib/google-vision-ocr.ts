type VisionImage = { content: Uint8Array; mimeType: string };

export async function recognizeSlicerImages(images: VisionImage[], apiKey: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ requests: images.map((image) => ({
      image: { content: Buffer.from(image.content).toString("base64") },
      features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      imageContext: { languageHints: ["pt", "en"] },
    })) }),
  });
  if (!response.ok) throw new Error(`ocr_provider_http_${response.status}`);
  const data = await response.json().catch(() => null) as { responses?: Array<{ fullTextAnnotation?: { text?: string }; textAnnotations?: Array<{ description?: string }>; error?: { message?: string } }> } | null;
  if (!Array.isArray(data?.responses) || data.responses.length !== images.length) throw new Error("ocr_provider_invalid_response");
  return data.responses.map((result) => {
    if (result.error) throw new Error("ocr_provider_image_error");
    return (result.fullTextAnnotation?.text ?? result.textAnnotations?.[0]?.description ?? "").slice(0, 6000);
  });
}

export async function recognizeCatalogImage(image: VisionImage, apiKey: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ requests: [{
      image: { content: Buffer.from(image.content).toString("base64") },
      features: [{ type: "OBJECT_LOCALIZATION", maxResults: 5 }, { type: "WEB_DETECTION", maxResults: 10 }, { type: "LABEL_DETECTION", maxResults: 10 }],
    }] }),
  });
  if (!response.ok) throw new Error(`image_search_provider_http_${response.status}`);
  const data = await response.json().catch(() => null) as { responses?: Array<{ localizedObjectAnnotations?: Array<{ name?: string }>; webDetection?: { webEntities?: Array<{ description?: string }> }; labelAnnotations?: Array<{ description?: string }>; error?: { message?: string } }> } | null;
  const result = data?.responses?.[0];
  if (!result || result.error) throw new Error("image_search_provider_invalid_response");
  const terms = [...(result.localizedObjectAnnotations ?? []).map((item) => item.name), ...(result.webDetection?.webEntities ?? []).map((item) => item.description), ...(result.labelAnnotations ?? []).map((item) => item.description)]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/[^\p{L}\p{N} -]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 20))
    .filter((item, index, all) => item.length > 1 && all.indexOf(item) === index)
    .slice(0, 4);
  return { terms, query: terms.map((term) => `"${term}"`).join(" OR ") };
}
