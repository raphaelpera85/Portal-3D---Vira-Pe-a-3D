import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNotificationChannelConfigured, sendNotificationDelivery, type NotificationDelivery } from "@/lib/notification-delivery";
import { getSiteUrl } from "@/lib/site-url";

export async function dispatchNotificationQueue() {
  const siteUrl = getSiteUrl();
  const supabase = createSupabaseAdminClient();
  if (!supabase || !siteUrl) return { status: 503, body: { error: "notification_service_not_configured" } };

  const { data, error } = await supabase.rpc("claim_store_notification_deliveries", { batch_size: 25 });
  if (error) return { status: 503, body: { error: "notification_queue_unavailable" } };
  const deliveries = (data ?? []) as NotificationDelivery[];
  const panelUrl = new URL("/painel/maker", siteUrl).toString();
  let sent = 0;
  let failed = 0;
  let deferred = 0;
  await Promise.all(deliveries.map(async (delivery) => {
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
      await supabase.rpc("fail_store_notification_delivery", { delivery_id: delivery.id, reason: result.reason });
      failed += 1;
    }
  }));
  return { status: 200, body: { processed: deliveries.length, sent, failed, deferred } };
}
