export type DiscoveredPrinterCandidate = { manufacturer: "Anycubic"; title: string; productType: string; sourceUrl: string };

const printerProductTypes = new Set(["FDM 3D Printer", "FDM 3D Printers", "LCD 3D Printer", "LCD 3D Printers"]);

export function parseAnycubicPrinterFeed(payload: unknown): DiscoveredPrinterCandidate[] {
  if (payload == null || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) return [];
  return ((payload as { products: unknown[] }).products).flatMap((value) => {
    if (value == null || typeof value !== "object") return [];
    const product = value as Record<string, unknown>;
    if (typeof product.title !== "string" || product.title.trim().length < 2 || product.title.length > 120
      || typeof product.handle !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.handle) || product.handle.length > 180
      || typeof product.product_type !== "string" || !printerProductTypes.has(product.product_type)
      || typeof product.vendor !== "string" || product.vendor.toLowerCase() !== "anycubic"
      || typeof product.published_at !== "string" || !Number.isFinite(Date.parse(product.published_at))) return [];
    return [{ manufacturer: "Anycubic" as const, title: product.title.trim(), productType: product.product_type, sourceUrl: `https://store.anycubic.com/products/${product.handle}` }];
  });
}

export function getUnknownPrinterCandidates(payload: unknown, knownSourceUrls: string[]) {
  const sourceKey = (value: string) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return null;
      return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
    } catch { return null; }
  };
  const known = new Set(knownSourceUrls.map(sourceKey).filter((value): value is string => value !== null));
  return parseAnycubicPrinterFeed(payload).filter((candidate) => !known.has(sourceKey(candidate.sourceUrl)!));
}

export async function readLimitedResponseText(response: Response, maximumBytes: number) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) throw new Error("Feed response too large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maximumBytes) {
      await reader.cancel();
      throw new Error("Feed response too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
