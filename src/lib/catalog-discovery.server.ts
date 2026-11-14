import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAllCatalogRows } from "./catalog-source-monitor";
import { getUnknownPrinterCandidates, officialPrinterFeeds, parseOfficialPrinterFeed, readLimitedResponseText } from "./catalog-discovery";

const maxFeedBytes = 8 * 1024 * 1024;
const maxFeedPages = 5;
const rotatingFeedPages = maxFeedPages - 1;
const feedPageWindows = 125;
const lastFeedPage = 1 + rotatingFeedPages * feedPageWindows;

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
      const cursorQuery = await supabase.from("catalog_discovery_cursors").select("next_page").eq("manufacturer", feed.manufacturer).maybeSingle();
      if (cursorQuery.error?.code === "PGRST205" || cursorQuery.error?.code === "42P01") {
        return { ok: true, skipped: "migration-required", checked, candidates: candidateCount, sourceFailures, storageFailures };
      }
      if (cursorQuery.error) {
        storageFailures += 1;
        continue;
      }
      const cursorPage = cursorQuery.data?.next_page;
      const startPage = typeof cursorPage === "number" && Number.isInteger(cursorPage) && cursorPage >= 2 && cursorPage <= lastFeedPage
        ? cursorPage
        : 2;
      const feedTimeout = AbortSignal.timeout(6_000);
      const pages = [1, ...Array.from({ length: rotatingFeedPages }, (_, index) => startPage + index)];
      let failed = false;
      let reachedEnd = false;
      for (const [index, page] of pages.entries()) {
        const url = new URL(feed.url);
        url.searchParams.set("page", String(page));
        try {
          const response = await fetch(url, {
            cache: "no-store", redirect: "manual", signal: feedTimeout,
            headers: { accept: "application/json", "user-agent": "ViraPeca3D-CatalogDiscovery/1.0" },
          });
          if (!response.ok || (response.status >= 300 && response.status < 400) || !response.headers.get("content-type")?.includes("application/json")) {
            sourceFailures += 1;
            failed = true;
            break;
          }
          const payload: unknown = JSON.parse(await readLimitedResponseText(response, maxFeedBytes));
          if (payload == null || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) {
            sourceFailures += 1;
            failed = true;
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
              failed = true;
              break;
            }
            candidateCount += candidates.length;
          }
          if (products.length < 250) {
            reachedEnd = true;
            break;
          }
          if (index === pages.length - 1) truncated = true;
        } catch {
          sourceFailures += 1;
          failed = true;
          break;
        }
      }
      if (!failed) {
        const nextPage = reachedEnd || startPage + rotatingFeedPages > lastFeedPage ? 2 : startPage + rotatingFeedPages;
        const { error } = await supabase.from("catalog_discovery_cursors").upsert({ manufacturer: feed.manufacturer, next_page: nextPage }, { onConflict: "manufacturer" });
        if (error?.code === "PGRST205" || error?.code === "42P01") {
          return { ok: true, skipped: "migration-required", checked, candidates: candidateCount, sourceFailures, storageFailures };
        }
        if (error) storageFailures += 1;
      }
    }

    return { ok: sourceFailures === 0 && storageFailures === 0, checked, candidates: candidateCount, sourceFailures, storageFailures, ...(truncated ? { truncated: true } : {}) };
  } catch {
    return { ok: false, checked: 0, candidates: 0, sourceFailures: 1, storageFailures: 0 };
  }
}
