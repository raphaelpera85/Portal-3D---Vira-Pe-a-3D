import "server-only";

import { isDesignerServiceDeliveryPath } from "@/lib/designer-service-delivery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function cleanupStaleDesignerServiceDeliveryUploads() {
  const admin = createSupabaseAdminClient();
  if (!admin) return { scanned: 0, removed: 0, error: "storage_not_configured" };
  const before = new Date(Date.now() - 26 * 60 * 60_000).toISOString();
  // shortcut: removes at most 100 expired uploads per daily run; raise the limit if the backlog repeatedly reaches 100.
  const { data, error } = await admin.from("designer_service_delivery_uploads")
    .select("storage_path").lt("created_at", before).order("created_at").limit(100);
  if (error) return { scanned: 0, removed: 0, error: "staging_queue_unavailable" };
  const paths = (data ?? []).map(({ storage_path }) => storage_path);
  if (!paths.length) return { scanned: 0, removed: 0 };
  if (paths.some((path) => !isDesignerServiceDeliveryPath(path.split("/")[0], path))) {
    return { scanned: paths.length, removed: 0, error: "invalid_staging_path" };
  }
  const { error: storageError } = await admin.storage.from("designer-service-deliveries").remove(paths);
  if (storageError) return { scanned: paths.length, removed: 0, error: "storage_cleanup_failed" };
  const { error: databaseError } = await admin.from("designer_service_delivery_uploads").delete().in("storage_path", paths);
  return { scanned: paths.length, removed: databaseError ? 0 : paths.length, ...(databaseError ? { error: "staging_cleanup_failed" } : {}) };
}
