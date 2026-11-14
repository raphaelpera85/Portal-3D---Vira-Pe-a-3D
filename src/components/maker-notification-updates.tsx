"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isMakerRealtimeUnavailable } from "@/lib/maker-notification-sync";

export function MakerNotificationUpdates({ storeId }: { storeId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    let fallbackInterval: number | null = null;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const startFallbackRefresh = () => {
      if (fallbackInterval === null) fallbackInterval = window.setInterval(refreshWhenVisible, 60_000);
    };
    const stopFallbackRefresh = () => {
      if (fallbackInterval !== null) window.clearInterval(fallbackInterval);
      fallbackInterval = null;
    };
    const channel = supabase.channel(`maker-requests-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_quote_requests", filter: `store_id=eq.${storeId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_print_request_targets", filter: `store_id=eq.${storeId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_purchase_orders", filter: `store_id=eq.${storeId}` }, () => router.refresh())
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") stopFallbackRefresh();
        else if (isMakerRealtimeUnavailable(status)) startFallbackRefresh();
      });
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      stopFallbackRefresh();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [router, storeId]);
  return null;
}
