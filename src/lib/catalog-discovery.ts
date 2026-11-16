export type DiscoveredPrinterCandidate = { manufacturer: "Anycubic" | "ELEGOO" | "Creality" | "QIDI Tech"; title: string; productType: string; sourceUrl: string };

export type OfficialPrinterFeed = {
  manufacturer: DiscoveredPrinterCandidate["manufacturer"];
  url: string;
  host: string;
  acceptedVendors: readonly string[];
  collectionScoped: boolean;
  collectionProductTypes?: readonly string[];
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
  {
    manufacturer: "QIDI Tech",
    url: "https://us.qidi3d.com/collections/3d-printers/products.json?limit=250",
    host: "us.qidi3d.com",
    acceptedVendors: ["qidi us store", "qidi tech"],
    collectionScoped: true,
    collectionProductTypes: ["Printer"],
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
      if ((!/\b3d printer\b/i.test(title) && !feed.collectionProductTypes?.includes(productType)) || /^\[.*?flash sale.*?\]/i.test(title)) return [];
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

export function getUnknownPrinterCandidates(
  payload: unknown,
  knownSourceUrls: string[],
  feed: OfficialPrinterFeed = officialPrinterFeeds[0],
  knownModels: { manufacturer: string; model: string }[] = [],
) {
  const sourceKey = (value: string) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return null;
      return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
    } catch { return null; }
  };
  const known = new Set(knownSourceUrls.map(sourceKey).filter((value): value is string => value !== null));
  return parseOfficialPrinterFeed(payload, feed).filter((candidate) => {
    const brand = candidate.manufacturer.split(/\s+/)[0];
    const titleModel = candidate.title.replace(new RegExp(`^${brand}\\s+`, "i"), "").replace(/\s+3d printers?$/i, "").trim().toLocaleLowerCase("en-US");
    return !known.has(sourceKey(candidate.sourceUrl)!) && !knownModels.some((knownModel) =>
      knownModel.manufacturer.toLocaleLowerCase("en-US") === candidate.manufacturer.toLocaleLowerCase("en-US")
      && knownModel.model.trim().toLocaleLowerCase("en-US") === titleModel,
    );
  });
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
