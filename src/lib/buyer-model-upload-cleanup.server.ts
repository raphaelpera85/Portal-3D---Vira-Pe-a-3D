import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storageName = /^[A-Za-z0-9_. -]{1,200}\.(stl|obj|3mf|glb|gltf|mtl|bin|png|jpg|jpeg|webp)$/i;

export async function cleanupStaleBuyerModelUploadReservations() {
  const admin = createSupabaseAdminClient();
  if (!admin) return { scanned: 0, removed: 0, error: "storage_not_configured" };
  const staleBefore = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
  const expiredBefore = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data, error } = await admin.from("buyer_model_upload_reservations")
    .select("buyer_id, bundle_id, files").in("status", ["active", "abandoned"])
    .is("cleaned_at", null).lt("created_at", staleBefore).order("created_at").limit(25);
  if (error) return { scanned: 0, removed: 0, error: "reservation_queue_unavailable" };
  const rows = data ?? [];
  if (rows.some((row) => !uuid.test(row.buyer_id) || !uuid.test(row.bundle_id) || !Array.isArray(row.files)
    || row.files.length < 1 || row.files.length > 10
    || row.files.some((file: { storage_name?: unknown }) => typeof file.storage_name !== "string" || !storageName.test(file.storage_name)))) {
    return { scanned: rows.length, removed: 0, error: "invalid_reservation_path" };
  }
  if (rows.length) {
    const paths = rows.flatMap((row) => (row.files as Array<{ storage_name: string }>).map((file) => `${row.buyer_id}/${row.bundle_id}/${file.storage_name}`));
    const { error: storageError } = await admin.storage.from("buyer-models").remove(paths);
    if (storageError) return { scanned: rows.length, removed: 0, error: "storage_cleanup_failed" };
    for (const row of rows) {
      const { error: markError } = await admin.from("buyer_model_upload_reservations").update({ status: "abandoned", cleaned_at: new Date().toISOString() })
        .eq("buyer_id", row.buyer_id).eq("bundle_id", row.bundle_id).is("cleaned_at", null);
      if (markError) return { scanned: rows.length, removed: 0, error: "reservation_cleanup_failed" };
    }
  }
  const [{ count: completedCount, error: completedError }, { count: abandonedCount, error: abandonedError }] = await Promise.all([
    admin.from("buyer_model_upload_reservations").delete({ count: "exact" }).eq("status", "completed").lt("created_at", expiredBefore),
    admin.from("buyer_model_upload_reservations").delete({ count: "exact" }).eq("status", "abandoned").not("cleaned_at", "is", null).lt("created_at", expiredBefore),
  ]);
  return {
    scanned: rows.length,
    removed: rows.length,
    purgedReservations: (completedCount ?? 0) + (abandonedCount ?? 0),
    ...((completedError || abandonedError) ? { error: "expired_reservation_cleanup_failed" } : {}),
  };
}
