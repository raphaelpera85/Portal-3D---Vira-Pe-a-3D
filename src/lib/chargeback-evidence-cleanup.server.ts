import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function cleanupStaleChargebackEvidenceUploads() {
  const admin = createSupabaseAdminClient();
  if (!admin) return { scanned: 0, removed: 0, error: "storage_not_configured" };
  const before = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  // shortcut: removes at most 100 expired uploads per daily run; raise the limit if staging regularly exceeds that backlog.
  const { data, error } = await admin.from("seller_order_chargeback_evidence_uploads")
    .select("object_path").lt("created_at", before).order("created_at").limit(100);
  if (error) return { scanned: 0, removed: 0, error: "staging_queue_unavailable" };
  const paths = (data ?? []).map(({ object_path }) => object_path);
  if (!paths.length) return { scanned: 0, removed: 0 };
  const { error: storageError } = await admin.storage.from("chargeback-evidence").remove(paths);
  if (storageError) return { scanned: paths.length, removed: 0, error: "storage_cleanup_failed" };
  const { error: databaseError } = await admin.from("seller_order_chargeback_evidence_uploads").delete().in("object_path", paths);
  return { scanned: paths.length, removed: databaseError ? 0 : paths.length, ...(databaseError ? { error: "staging_cleanup_failed" } : {}) };
}
