"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function MakerNotificationUpdates({ storeId }: { storeId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(`maker-requests-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_quote_requests", filter: `store_id=eq.${storeId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_print_request_targets", filter: `store_id=eq.${storeId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_purchase_orders", filter: `store_id=eq.${storeId}` }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router, storeId]);
  return null;
}
