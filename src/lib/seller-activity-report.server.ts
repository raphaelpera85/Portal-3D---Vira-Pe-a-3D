import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildSellerActivityReportRows, getSellerActivityReportWindows, sellerOrderReportStatuses, type SellerActivityCounts } from "./seller-activity-report";

type ReportClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export async function loadSellerActivityReport(db: ReportClient, storeId: string) {
  const windows = getSellerActivityReportWindows();
  const countOrders = (since: string, status: (typeof sellerOrderReportStatuses)[number]["status"]) => db
    .from("seller_purchase_orders").select("id", { count: "exact", head: true })
    .eq("store_id", storeId).eq("status", status).gte("created_at", since).lte("created_at", windows.through);
  const countProductRequests = (since: string, requestType: "quote" | "purchase") => db
    .from("product_quote_requests").select("id", { count: "exact", head: true })
    .eq("store_id", storeId).eq("request_type", requestType).gte("created_at", since).lte("created_at", windows.through);
  const countCustomPrints = (since: string) => db
    .from("custom_print_request_targets").select("id", { count: "exact", head: true })
    .eq("store_id", storeId).gte("created_at", since).lte("created_at", windows.through);

  const [orderPeriods, quotePeriods, productPurchasePeriods, customPrintPeriods] = await Promise.all([
    Promise.all(sellerOrderReportStatuses.map(async ({ status }) => {
      const [sevenDays, thirtyDays] = await Promise.all([
        countOrders(windows.sevenDays, status),
        countOrders(windows.thirtyDays, status),
      ]);
      return { status, sevenDays, thirtyDays };
    })),
    Promise.all([countProductRequests(windows.sevenDays, "quote"), countProductRequests(windows.thirtyDays, "quote")]),
    Promise.all([countProductRequests(windows.sevenDays, "purchase"), countProductRequests(windows.thirtyDays, "purchase")]),
    Promise.all([countCustomPrints(windows.sevenDays), countCustomPrints(windows.thirtyDays)]),
  ]);

  const queryResults = [
    ...orderPeriods.flatMap(({ sevenDays, thirtyDays }) => [sevenDays, thirtyDays]),
    ...quotePeriods,
    ...productPurchasePeriods,
    ...customPrintPeriods,
  ];
  const unavailable = queryResults.some((result) => result.error || result.count === null);
  const orderCounts = Object.fromEntries(orderPeriods.map(({ status, sevenDays, thirtyDays }) => [status, {
    sevenDays: sevenDays.count ?? 0,
    thirtyDays: thirtyDays.count ?? 0,
  }])) as SellerActivityCounts["orders"];
  const rows = unavailable ? [] : buildSellerActivityReportRows({
    orders: orderCounts,
    productQuotes: { sevenDays: quotePeriods[0].count ?? 0, thirtyDays: quotePeriods[1].count ?? 0 },
    productPurchases: { sevenDays: productPurchasePeriods[0].count ?? 0, thirtyDays: productPurchasePeriods[1].count ?? 0 },
    customPrints: { sevenDays: customPrintPeriods[0].count ?? 0, thirtyDays: customPrintPeriods[1].count ?? 0 },
  });

  return { unavailable, rows };
}
