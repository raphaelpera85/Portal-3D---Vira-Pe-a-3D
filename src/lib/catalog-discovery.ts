export type DiscoveredPrinterCandidate = { manufacturer: "Anycubic" | "ELEGOO" | "Creality"; title: string; productType: string; sourceUrl: string };

export type OfficialPrinterFeed = {
  manufacturer: DiscoveredPrinterCandidate["manufacturer"];
  url: string;
  host: string;
  acceptedVendors: readonly string[];
  collectionScoped: boolean;
};

export const officialPrinterFeeds: readonly OfficialPrinterFeed[] = [
  {
    manufacturer: "Anycubic",
    url: "https://store.anycubic.com/products.json?limit=250",
    host: "store.anycubic.com",
    acceptedVendors: ["anycubic"],
    collectionScoped: false,
  },
  {
    manufacturer: "ELEGOO",
    url: "https://us.elegoo.com/collections/3d-printers/products.json?limit=250",
    host: "us.elegoo.com",
    acceptedVendors: ["elegoo"],
    collectionScoped: false,
  },
  {
    manufacturer: "Creality",
    url: "https://us.store.creality.com/collections/3d-printers/products.json?limit=250",
    host: "us.store.creality.com",
    acceptedVendors: ["creality", "creality official store", "creality usa"],
    collectionScoped: true,
  },
];

const printerProductTypes = new Set(["FDM 3D Printer", "FDM 3D Printers", "LCD 3D Printer", "LCD 3D Printers"]);

export function parseOfficialPrinterFeed(payload: unknown, feed: OfficialPrinterFeed): DiscoveredPrinterCandidate[] {
  if (payload == null || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) return [];
  return ((payload as { products: unknown[] }).products).flatMap((value) => {
    if (value == null || typeof value !== "object") return [];
    const product = value as Record<string, unknown>;
    if (typeof product.title !== "string" || product.title.trim().length < 2 || product.title.length > 120
      || typeof product.handle !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.handle) || product.handle.length > 180
      || typeof product.vendor !== "string" || !feed.acceptedVendors.includes(product.vendor.trim().toLowerCase())
      || typeof product.published_at !== "string" || !Number.isFinite(Date.parse(product.published_at))) return [];
    const title = product.title.trim();
    const productType = typeof product.product_type === "string" ? product.product_type : "";
    if (feed.collectionScoped) {
      if (!/\b3d printer\b/i.test(title) || /^\[.*?flash sale.*?\]/i.test(title)) return [];
    } else if (!printerProductTypes.has(productType)) return [];
    if (feed.manufacturer === "ELEGOO" && /\b(bundle|frequently bought together|all-in-one)\b|with mercury/i.test(title)) return [];
    return [{
      manufacturer: feed.manufacturer,
      title,
      productType: printerProductTypes.has(productType) ? productType : "3D Printer",
      sourceUrl: `https://${feed.host}/products/${product.handle}`,
    }];
  });
}

export function parseAnycubicPrinterFeed(payload: unknown) {
  return parseOfficialPrinterFeed(payload, officialPrinterFeeds[0]);
}

export function getUnknownPrinterCandidates(payload: unknown, knownSourceUrls: string[], feed: OfficialPrinterFeed = officialPrinterFeeds[0]) {
  const sourceKey = (value: string) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return null;
      return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
    } catch { return null; }
  };
  const known = new Set(knownSourceUrls.map(sourceKey).filter((value): value is string => value !== null));
  return parseOfficialPrinterFeed(payload, feed).filter((candidate) => !known.has(sourceKey(candidate.sourceUrl)!));
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
