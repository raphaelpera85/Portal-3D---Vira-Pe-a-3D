import "server-only";

import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNotificationChannelConfigured, sendNotificationDelivery, type NotificationDelivery } from "@/lib/notification-delivery";
import { getSiteUrl } from "@/lib/site-url";
import { getNotificationPanelPath } from "@/lib/notification-messages";

export async function dispatchNotificationQueue() {
  const siteUrl = getSiteUrl();
  const supabase = createSupabaseAdminClient();
  if (!supabase || !siteUrl) return { status: 503, body: { error: "notification_service_not_configured" } };

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let deferred = 0;
  let reachedBatchLimit = false;
  // shortcut: 100 deliveries per invocation; continue remaining work in a new function invocation.
  for (let batch = 0; batch < 4; batch += 1) {
    const { data, error } = await supabase.rpc("claim_store_notification_deliveries", { batch_size: 25 });
    if (error) return { status: 503, body: { error: "notification_queue_unavailable", processed, sent, failed, deferred } };
    const deliveries = (data ?? []) as NotificationDelivery[];
    processed += deliveries.length;
    if (deliveries.length === 0) break;

    await Promise.all(deliveries.map(async (delivery) => {
      if (!isNotificationChannelConfigured(delivery.channel, process.env, delivery.payload.notification_type)) {
        const { error: deferError } = await supabase.rpc("defer_store_notification_delivery", { delivery_id: delivery.id });
        if (deferError) failed += 1;
        else deferred += 1;
        return;
      }
      let deliveryForSend = delivery;
      if (delivery.channel === "whatsapp") {
        const { data: authorized, error: authorizationError } = await supabase.rpc("authorize_store_notification_whatsapp_delivery", { delivery_id: delivery.id });
        if (authorizationError || authorized !== true) {
          if (authorizationError) await supabase.rpc("fail_store_notification_delivery", { delivery_id: delivery.id, reason: "whatsapp_consent_check_failed" });
          failed += 1;
          return;
        }
      }
      if (delivery.channel === "email" && delivery.payload.notification_type !== "support_reply" && delivery.payload.notification_type !== "designer_service_request") {
        const { data: currentEmail, error: authorizationError } = await supabase.rpc("authorize_store_notification_email_delivery", { delivery_id: delivery.id });
        if (authorizationError) {
          await supabase.rpc("fail_store_notification_delivery", { delivery_id: delivery.id, reason: "email_contact_check_failed" });
          failed += 1;
          return;
        }
        if (typeof currentEmail !== "string" || !currentEmail) {
          failed += 1;
          return;
        }
        deliveryForSend = { ...delivery, destination: currentEmail };
      }
      const destinationUrl = new URL(getNotificationPanelPath(delivery.payload.notification_type), siteUrl).toString();
      const result = await sendNotificationDelivery(deliveryForSend, destinationUrl);
      if (result.ok) {
        const { error: completeError } = await supabase.rpc("complete_store_notification_delivery", { delivery_id: delivery.id, message_id: result.messageId });
        if (completeError) failed += 1;
        else sent += 1;
      } else {
        await supabase.rpc("fail_store_notification_delivery", { delivery_id: delivery.id, reason: result.reason });
        failed += 1;
      }
    }));
    reachedBatchLimit = batch === 3 && deliveries.length === 25;
    if (deliveries.length < 25) break;
  }
  let hasMore = false;
  if (reachedBatchLimit) {
    const now = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
    const [pending, stale] = await Promise.all([
      supabase.from("store_notification_deliveries").select("id", { count: "exact", head: true })
        .lt("attempts", 5).eq("status", "pending").lte("next_attempt_at", now),
      supabase.from("store_notification_deliveries").select("id", { count: "exact", head: true })
        .lt("attempts", 5).eq("status", "sending").lt("updated_at", staleBefore),
    ]);
    hasMore = Boolean(pending.error || stale.error || pending.count || stale.count);
    if (!pending.error && !stale.error && (pending.count || stale.count) && process.env.CRON_SECRET) {
      after(async () => {
        const response = await fetch(new URL("/api/notifications/dispatch", siteUrl), {
          method: "POST",
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`notification_queue_continuation_failed:${response.status}`);
      });
    }
  }
  return { status: hasMore ? 202 : 200, body: { processed, sent, failed, deferred, hasMore } };
}
