import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAllCatalogRows } from "./catalog-source-monitor";
import { getUnknownPrinterCandidates, parseAnycubicPrinterFeed, readLimitedResponseText } from "./catalog-discovery";

const feedUrl = "https://store.anycubic.com/products.json?limit=250";
const maxFeedBytes = 8 * 1024 * 1024;
const maxFeedPages = 5;

export async function runCatalogModelDiscovery() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, checked: 0, candidates: 0, sourceFailures: 0, storageFailures: 1 };

  try {
    const known = await fetchAllCatalogRows(async (from, to) => await supabase.from("printer_models").select("source_url").order("id").range(from, to));
    if (known.error) return { ok: false, checked: 0, candidates: 0, sourceFailures: 0, storageFailures: 1 };
    const knownSourceUrls = (known.data ?? []).map((row) => row.source_url).filter((url): url is string => typeof url === "string");
    let checked = 0;
    let candidateCount = 0;
    const feedTimeout = AbortSignal.timeout(20_000);
    for (let page = 1; page <= maxFeedPages; page += 1) {
      const url = new URL(feedUrl);
      url.searchParams.set("page", String(page));
      const response = await fetch(url, {
        cache: "no-store", redirect: "manual", signal: feedTimeout,
        headers: { accept: "application/json", "user-agent": "ViraPeca3D-CatalogDiscovery/1.0" },
      });
      if (!response.ok || (response.status >= 300 && response.status < 400) || !response.headers.get("content-type")?.includes("application/json")) {
        return { ok: false, checked, candidates: candidateCount, sourceFailures: 1, storageFailures: 0 };
      }
      const payload: unknown = JSON.parse(await readLimitedResponseText(response, maxFeedBytes));
      if (payload == null || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) {
        return { ok: false, checked, candidates: candidateCount, sourceFailures: 1, storageFailures: 0 };
      }
      const products = (payload as { products: unknown[] }).products;
      checked += parseAnycubicPrinterFeed(payload).length;
      const candidates = getUnknownPrinterCandidates(payload, knownSourceUrls);
      if (candidates.length) {
        const { error } = await supabase.from("catalog_discovery_candidates").upsert(candidates.map((candidate) => ({
          manufacturer: candidate.manufacturer,
          product_title: candidate.title,
          product_type: candidate.productType,
          source_url: candidate.sourceUrl,
        })), { onConflict: "source_url", ignoreDuplicates: true });
        if (error?.code === "PGRST205" || error?.code === "42P01") {
          return { ok: true, skipped: "migration-required", checked, candidates: candidateCount + candidates.length, sourceFailures: 0, storageFailures: 0 };
        }
        if (error) return { ok: false, checked, candidates: candidateCount, sourceFailures: 0, storageFailures: 1 };
        candidateCount += candidates.length;
      }
      if (products.length < 250) return { ok: true, checked, candidates: candidateCount, sourceFailures: 0, storageFailures: 0 };
    }
    // shortcut: cap at 1,250 products per run; persist a feed cursor if the official catalog grows beyond this cap.
    return { ok: false, checked, candidates: candidateCount, sourceFailures: 1, storageFailures: 0, truncated: true };
  } catch {
    return { ok: false, checked: 0, candidates: 0, sourceFailures: 1, storageFailures: 0 };
  }
}
