import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNotificationChannelConfigured, sendNotificationDelivery, type NotificationDelivery } from "@/lib/notification-delivery";
import { getSiteUrl } from "@/lib/site-url";

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
  const siteUrl = getSiteUrl();
  const supabase = createSupabaseAdminClient();
  if (!supabase || !siteUrl) return Response.json({ error: "notification_service_not_configured" }, { status: 503 });

  const { data: deliveries, error } = await supabase.rpc("claim_store_notification_deliveries", { batch_size: 25 });
  if (error) return Response.json({ error: "notification_queue_unavailable" }, { status: 503 });
  const panelUrl = new URL("/painel/maker", siteUrl).toString();
  let sent = 0;
  let failed = 0;
  let deferred = 0;
  await Promise.all((deliveries as NotificationDelivery[]).map(async (delivery) => {
    if (!isNotificationChannelConfigured(delivery.channel)) {
      const { error: deferError } = await supabase.rpc("defer_store_notification_delivery", { delivery_id: delivery.id });
      if (deferError) failed += 1;
      else deferred += 1;
      return;
    }
    const result = await sendNotificationDelivery(delivery, panelUrl);
    if (result.ok) {
      const { error: completeError } = await supabase.rpc("complete_store_notification_delivery", { delivery_id: delivery.id, message_id: result.messageId });
      if (completeError) failed += 1;
      else sent += 1;
    } else {
      const { error: failError } = await supabase.rpc("fail_store_notification_delivery", { delivery_id: delivery.id, reason: result.reason });
      if (failError) failed += 1;
      else failed += 1;
    }
  }));
  return Response.json({ processed: (deliveries as NotificationDelivery[]).length, sent, failed, deferred });
}
