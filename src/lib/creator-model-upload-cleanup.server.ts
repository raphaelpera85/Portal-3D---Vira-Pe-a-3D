import "server-only";

import { isCreatorModelPreviewPath, isCreatorModelUploadPath } from "@/lib/creator-model-upload";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function cleanupStaleCreatorModelUploads() {
  const admin = createSupabaseAdminClient();
  if (!admin) return { scanned: 0, removed: 0, error: "storage_not_configured" };
  const before = new Date(Date.now() - 26 * 60 * 60_000).toISOString();
  // shortcut: removes at most 100 expired uploads per daily run; raise the limit if the backlog repeatedly reaches 100.
  const { data, error } = await admin.from("creator_model_submissions").select("id, submitted_by, storage_path, preview_path")
    .eq("review_status", "uploading").lt("created_at", before).order("created_at").limit(100);
  if (error) return { scanned: 0, removed: 0, error: "staging_queue_unavailable" };
  const rows = data ?? [];
  if (!rows.length) return { scanned: 0, removed: 0 };
  if (rows.some((row) => !row.storage_path || !isCreatorModelUploadPath(row.submitted_by, row.storage_path, row.id)
    || (row.preview_path && !isCreatorModelPreviewPath(row.submitted_by, row.preview_path, row.id)))) {
    return { scanned: rows.length, removed: 0, error: "invalid_staging_path" };
  }
  const paths = rows.flatMap(({ storage_path, preview_path }) => [storage_path!, ...(preview_path ? [preview_path] : [])]);
  const { error: storageError } = await admin.storage.from("creator-model-uploads").remove(paths);
  if (storageError) return { scanned: rows.length, removed: 0, error: "storage_cleanup_failed" };
  const { error: deleteError } = await admin.from("creator_model_submissions").delete().in("id", rows.map(({ id }) => id))
    .eq("review_status", "uploading");
  return { scanned: rows.length, removed: deleteError ? 0 : rows.length, ...(deleteError ? { error: "staging_cleanup_failed" } : {}) };
}
