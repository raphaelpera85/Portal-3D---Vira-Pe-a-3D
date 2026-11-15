import { timingSafeEqual } from "node:crypto";
import { dispatchNotificationQueue } from "@/lib/notification-dispatch.server";
import { reconcilePendingSellerRefunds } from "@/lib/seller-payment-reconciliation.server";
import { cleanupStaleChargebackEvidenceUploads } from "@/lib/chargeback-evidence-cleanup.server";
import { runCatalogSourceCheck } from "@/lib/catalog-source-check.server";
import { runCatalogModelDiscovery } from "@/lib/catalog-discovery.server";
import { cleanupStaleDesignerServiceDeliveryUploads } from "@/lib/designer-service-delivery-cleanup.server";
import { cleanupStaleCreatorModelUploads } from "@/lib/creator-model-upload-cleanup.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
const isAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  return Boolean(secret && safeEqual(authorization, `Bearer ${secret}`));
};

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await dispatchNotificationQueue();
  return Response.json(result.body, { status: result.status });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await dispatchNotificationQueue();
  const refunds = await reconcilePendingSellerRefunds();
  const evidenceCleanup = await cleanupStaleChargebackEvidenceUploads();
  const designerDeliveryCleanup = await cleanupStaleDesignerServiceDeliveryUploads();
  const creatorModelUploadCleanup = await cleanupStaleCreatorModelUploads();
  const catalogSourceCheck = await runCatalogSourceCheck();
  const catalogDiscovery = await runCatalogModelDiscovery();
  const status = result.status === 200 && (!catalogSourceCheck.ok || !catalogDiscovery.ok) ? 500 : result.status;
  return Response.json({ notifications: result.body, refundReconciliation: refunds, evidenceCleanup, designerDeliveryCleanup, creatorModelUploadCleanup, catalogSourceCheck, catalogDiscovery }, { status });
}
