import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAllCatalogRows } from "./catalog-source-monitor";
import { getUnknownPrinterCandidates, parseAnycubicPrinterFeed, readLimitedResponseText } from "./catalog-discovery";

const feedUrl = "https://store.anycubic.com/products.json?limit=250&page=1";
const maxFeedBytes = 8 * 1024 * 1024;

export async function runCatalogModelDiscovery() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, checked: 0, candidates: 0, sourceFailures: 0, storageFailures: 1 };

  try {
    const response = await fetch(feedUrl, {
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json", "user-agent": "ViraPeca3D-CatalogDiscovery/1.0" },
    });
    if (!response.ok || (response.status >= 300 && response.status < 400) || !response.headers.get("content-type")?.includes("application/json")) {
      return { ok: false, checked: 0, candidates: 0, sourceFailures: 1, storageFailures: 0 };
    }
    const payload: unknown = JSON.parse(await readLimitedResponseText(response, maxFeedBytes));
    if (payload == null || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) {
      return { ok: false, checked: 0, candidates: 0, sourceFailures: 1, storageFailures: 0 };
    }

    const known = await fetchAllCatalogRows(async (from, to) => await supabase.from("printer_models").select("source_url").order("id").range(from, to));
    if (known.error) return { ok: false, checked: 0, candidates: 0, sourceFailures: 0, storageFailures: 1 };
    const recognized = parseAnycubicPrinterFeed(payload);
    const candidates = getUnknownPrinterCandidates(payload, (known.data ?? []).map((row) => row.source_url).filter((url): url is string => typeof url === "string"));
    if (!candidates.length) return { ok: true, checked: recognized.length, candidates: 0, sourceFailures: 0, storageFailures: 0 };

    // shortcut: scan first 250 products; add cursor pagination if new models can fall outside this page.
    const { error } = await supabase.from("catalog_discovery_candidates").upsert(candidates.map((candidate) => ({
      manufacturer: candidate.manufacturer,
      product_title: candidate.title,
      product_type: candidate.productType,
      source_url: candidate.sourceUrl,
    })), { onConflict: "source_url", ignoreDuplicates: true });
    if (error?.code === "PGRST205" || error?.code === "42P01") {
      return { ok: true, skipped: "migration-required", checked: recognized.length, candidates: candidates.length, sourceFailures: 0, storageFailures: 0 };
    }
    return { ok: !error, checked: recognized.length, candidates: candidates.length, sourceFailures: 0, storageFailures: error ? 1 : 0 };
  } catch {
    return { ok: false, checked: 0, candidates: 0, sourceFailures: 1, storageFailures: 0 };
  }
}
