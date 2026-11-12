import { timingSafeEqual } from "node:crypto";
import { dispatchNotificationQueue } from "@/lib/notification-dispatch.server";
import { reconcilePendingSellerRefunds } from "@/lib/seller-payment-reconciliation.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await dispatchNotificationQueue();
  const refunds = await reconcilePendingSellerRefunds();
  return Response.json({ notifications: result.body, refundReconciliation: refunds }, { status: result.status });
}
