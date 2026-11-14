import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAllCatalogRows } from "./catalog-source-monitor";
import { getUnknownPrinterCandidates, officialPrinterFeeds, parseOfficialPrinterFeed, readLimitedResponseText } from "./catalog-discovery";

const maxFeedBytes = 8 * 1024 * 1024;
// shortcut: scan at most 1,250 products per source per run; persist cursors if a feed needs broader coverage.
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
    let sourceFailures = 0;
    let storageFailures = 0;
    let truncated = false;

    for (const feed of officialPrinterFeeds) {
      const feedTimeout = AbortSignal.timeout(6_000);
      for (let page = 1; page <= maxFeedPages; page += 1) {
        const url = new URL(feed.url);
        url.searchParams.set("page", String(page));
        try {
          const response = await fetch(url, {
            cache: "no-store", redirect: "manual", signal: feedTimeout,
            headers: { accept: "application/json", "user-agent": "ViraPeca3D-CatalogDiscovery/1.0" },
          });
          if (!response.ok || (response.status >= 300 && response.status < 400) || !response.headers.get("content-type")?.includes("application/json")) {
            sourceFailures += 1;
            break;
          }
          const payload: unknown = JSON.parse(await readLimitedResponseText(response, maxFeedBytes));
          if (payload == null || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) {
            sourceFailures += 1;
            break;
          }
          const products = (payload as { products: unknown[] }).products;
          checked += parseOfficialPrinterFeed(payload, feed).length;
          const candidates = getUnknownPrinterCandidates(payload, knownSourceUrls, feed);
          if (candidates.length) {
            const { error } = await supabase.from("catalog_discovery_candidates").upsert(candidates.map((candidate) => ({
              manufacturer: candidate.manufacturer,
              product_title: candidate.title,
              product_type: candidate.productType,
              source_url: candidate.sourceUrl,
            })), { onConflict: "source_url", ignoreDuplicates: true });
            if (error?.code === "PGRST205" || error?.code === "42P01") {
              return { ok: true, skipped: "migration-required", checked, candidates: candidateCount + candidates.length, sourceFailures, storageFailures };
            }
            if (error) {
              storageFailures += 1;
              break;
            }
            candidateCount += candidates.length;
          }
          if (products.length < 250) break;
          if (page === maxFeedPages) {
            sourceFailures += 1;
            truncated = true;
          }
        } catch {
          sourceFailures += 1;
          break;
        }
      }
    }

    return { ok: sourceFailures === 0 && storageFailures === 0, checked, candidates: candidateCount, sourceFailures, storageFailures, ...(truncated ? { truncated: true } : {}) };
  } catch {
    return { ok: false, checked: 0, candidates: 0, sourceFailures: 1, storageFailures: 0 };
  }
}
