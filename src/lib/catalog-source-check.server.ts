import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { classifyCatalogSourceResponse, getAllowedCatalogRedirect, hasCatalogSourceBeenCheckedInCycle, isAllowedCatalogSourceUrl, type CatalogSourceEvent } from "./catalog-source-monitor";

type CatalogType = "printer" | "material" | "nozzle";
type SourceRecord = { catalog_type: CatalogType; id: string; record_label: string; source_url: string };
type WatchState = { catalog_type: CatalogType; record_id: string; source_url: string; etag: string | null; last_modified: string | null; last_checked_at: string };

const catalogTypes: CatalogType[] = ["printer", "material", "nozzle"];

const eventFingerprint = (event: CatalogSourceEvent, status: number, etag: string | null, lastModified: string | null, previous: WatchState | null) =>
  createHash("sha256").update(JSON.stringify([event, status, etag, lastModified, previous?.etag ?? null, previous?.last_modified ?? null])).digest("hex");

async function fetchSourceHeaders(url: string, allowedHosts: string) {
  let target = url;
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    const response = await fetch(target, {
      method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(4000),
      headers: { "user-agent": "ViraPeca3D-CatalogSourceMonitor/1.0" },
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    const next = location ? getAllowedCatalogRedirect(target, location, allowedHosts) : null;
    if (!next || redirects === 2) return response;
    target = next;
  }
  throw new Error("redirect limit");
}

export async function runCatalogSourceCheck(now = new Date()) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, skipped: null, checked: 0, alerts: 0, uncheckable: 0, sourceFailures: 0, storageFailures: 1 };

  const [printerSources, materialSources, nozzleSources] = await Promise.all([
    supabase.from("printer_models").select("id, manufacturer, model, variant, source_url").eq("catalog_status", "published").not("source_url", "is", null).limit(1000),
    supabase.from("material_catalog").select("id, manufacturer, product, source_url").eq("catalog_status", "published").not("source_url", "is", null).limit(1000),
    supabase.from("nozzle_catalog").select("id, manufacturer, model, interface, source_url").eq("catalog_status", "published").not("source_url", "is", null).limit(1000),
  ]);
  if (printerSources.error || materialSources.error || nozzleSources.error) return { ok: false, skipped: null, checked: 0, alerts: 0, uncheckable: 0, sourceFailures: 0, storageFailures: 1 };
  const sourceRows: SourceRecord[] = [
    ...(printerSources.data ?? []).map((row) => ({ catalog_type: "printer" as const, id: row.id, record_label: [row.manufacturer, row.model, row.variant].filter(Boolean).join(" "), source_url: row.source_url! })),
    ...(materialSources.data ?? []).map((row) => ({ catalog_type: "material" as const, id: row.id, record_label: [row.manufacturer, row.product].filter(Boolean).join(" "), source_url: row.source_url! })),
    ...(nozzleSources.data ?? []).map((row) => ({ catalog_type: "nozzle" as const, id: row.id, record_label: [row.manufacturer, row.model, row.interface].filter(Boolean).join(" "), source_url: row.source_url! })),
  ];

  const stateRows = await Promise.all(catalogTypes.map(async (catalog_type) => {
    const ids = sourceRows.filter((row) => row.catalog_type === catalog_type).map((row) => row.id);
    if (!ids.length) return [] as WatchState[];
    const { data, error } = await supabase.from("catalog_source_watch_state").select("catalog_type, record_id, source_url, etag, last_modified, last_checked_at").eq("catalog_type", catalog_type).in("record_id", ids);
    return error ? null : data as WatchState[];
  }));
  if (stateRows.some((rows) => rows == null)) return { ok: false, skipped: null, checked: 0, alerts: 0, uncheckable: 0, sourceFailures: 0, storageFailures: 1 };
  const states = new Map((stateRows.flat() as WatchState[]).map((row) => [`${row.catalog_type}:${row.record_id}`, row]));
  const ordered = sourceRows.filter((record) => {
    const previous = states.get(`${record.catalog_type}:${record.id}`);
    return previous?.source_url !== record.source_url || !hasCatalogSourceBeenCheckedInCycle(previous?.last_checked_at, now, process.env.CATALOG_SOURCE_CHECK_DAY_UTC);
  }).sort((left, right) => {
    const a = states.get(`${left.catalog_type}:${left.id}`)?.last_checked_at ?? "";
    const b = states.get(`${right.catalog_type}:${right.id}`)?.last_checked_at ?? "";
    return a.localeCompare(b);
  // shortcut: cap each daily batch at 24 for the 60s function budget; add resumable workers if sources exceed 168 per week.
  }).slice(0, 24);
  if (!ordered.length) return { ok: true, skipped: "all-sources-checked-this-cycle", checked: 0, alerts: 0, uncheckable: 0, sourceFailures: 0, storageFailures: 0 };
  const extraHosts = process.env.CATALOG_SOURCE_ALLOWED_HOSTS ?? "";
  const counts = { ok: true, skipped: null as string | null, checked: 0, alerts: 0, uncheckable: 0, sourceFailures: 0, storageFailures: 0 };

  for (let offset = 0; offset < ordered.length; offset += 8) {
    await Promise.all(ordered.slice(offset, offset + 8).map(async (record) => {
      const previous = states.get(`${record.catalog_type}:${record.id}`) ?? null;
      const priorCheck = previous?.source_url === record.source_url ? previous : null;
      counts.checked += 1;
      let status = 0;
      let etag: string | null = null;
      let lastModified: string | null = null;
      let decision: ReturnType<typeof classifyCatalogSourceResponse>;

      if (!isAllowedCatalogSourceUrl(record.source_url, extraHosts)) {
        decision = { state: "failed", event: "source_check_failed", detail: "O domínio HTTPS não está na lista de fontes oficiais permitidas." };
      } else {
        try {
          const response = await fetchSourceHeaders(record.source_url, extraHosts);
          status = response.status;
          etag = response.headers.get("etag");
          lastModified = response.headers.get("last-modified");
          decision = classifyCatalogSourceResponse(priorCheck ? { etag: priorCheck.etag, lastModified: priorCheck.last_modified } : null, { status, etag, lastModified });
        } catch {
          decision = { state: "failed", event: null, detail: "Falha de conexão ou tempo limite; a especificação não foi alterada." };
        }
      }

      if (decision.event) {
        const { data, error } = await supabase.from("catalog_update_history").upsert({
          catalog_type: record.catalog_type, record_id: record.id, record_label: record.record_label, source_url: record.source_url,
          event_type: decision.event, source_fingerprint: eventFingerprint(decision.event, status, etag, lastModified, priorCheck),
          observed_etag: etag, observed_last_modified: lastModified, observed_http_status: status || null,
        }, { onConflict: "catalog_type,record_id,event_type,source_fingerprint", ignoreDuplicates: true }).select("id").maybeSingle();
        if (error) counts.storageFailures += 1;
        else if (data) counts.alerts += 1;
      }

      if (decision.state === "uncheckable") counts.uncheckable += 1;
      if (decision.state === "failed") counts.sourceFailures += 1;
      const { error } = await supabase.from("catalog_source_watch_state").upsert({
        catalog_type: record.catalog_type, record_id: record.id, record_label: record.record_label, source_url: record.source_url,
        last_checked_at: now.toISOString(), last_http_status: status || null, etag, last_modified: lastModified,
        watch_state: decision.state, check_detail: decision.detail,
      }, { onConflict: "catalog_type,record_id" });
      if (error) counts.storageFailures += 1;
    }));
  }

  counts.ok = counts.storageFailures === 0;
  return counts;
}
