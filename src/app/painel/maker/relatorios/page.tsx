import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { buildSellerActivityReportRows, getSellerActivityReportWindows, sellerOrderReportStatuses, type SellerActivityCounts } from "@/lib/seller-activity-report";
import { getUserWithRole } from "@/lib/auth-role.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Relatórios da loja | ViraPeça 3D", robots: { index: false, follow: false } };

export default async function MakerReportsPage() {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  const { data: store } = await actor.supabase.from("stores").select("id, name").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker");

  const db = actor.supabase;
  const windows = getSellerActivityReportWindows();
  const countOrders = (since: string, status: (typeof sellerOrderReportStatuses)[number]["status"]) => db
    .from("seller_purchase_orders").select("id", { count: "exact", head: true })
    .eq("store_id", store.id).eq("status", status).gte("created_at", since).lte("created_at", windows.through);
  const countProductRequests = (since: string, requestType: "quote" | "purchase") => db
    .from("product_quote_requests").select("id", { count: "exact", head: true })
    .eq("store_id", store.id).eq("request_type", requestType).gte("created_at", since).lte("created_at", windows.through);
  const countCustomPrints = (since: string) => db
    .from("custom_print_request_targets").select("id", { count: "exact", head: true })
    .eq("store_id", store.id).gte("created_at", since).lte("created_at", windows.through);

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

  return (
    <>
      <SiteHeader />
      <main className="maker-dashboard shell maker-finance-page">
        <Link className="viewer-back-link" href="/painel/maker">← Voltar ao painel</Link>
        <div className="account-heading maker-dashboard-heading">
          <p className="eyebrow">RELATÓRIOS DA LOJA</p>
          <h1>{store.name}</h1>
          <p>Pedidos e solicitações recebidos pela sua loja em períodos recentes.</p>
        </div>
        <p className="maker-finance-link"><Link className="button button-secondary" href="/painel/maker/financeiro">Abrir financeiro e pagamentos →</Link></p>
        {unavailable ? <section className="account-card maker-products-card" role="alert">
          <h2>Relatório indisponível</h2>
          <p>Não foi possível consultar a atividade da loja. Confira as migrações do marketplace e tente novamente.</p>
        </section> : <section className="account-card maker-products-card seller-finance-ledger">
          <span className="account-kicker">ATIVIDADE RECEBIDA</span>
          <h2>Pedidos e solicitações</h2>
          <p className="seller-finance-note">As contagens usam a data de criação e o status atual. Elas não representam pagamentos confirmados, receita ou repasses.</p>
          <div className="seller-finance-table-wrap">
            <table className="seller-finance-table seller-activity-report-table">
              <caption className="sr-only">Pedidos e solicitações criados nos últimos sete e trinta dias</caption>
              <thead><tr><th scope="col">Tipo e situação</th><th scope="col">7 dias</th><th scope="col">30 dias</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{new Intl.NumberFormat("pt-BR").format(row.sevenDays)}</td><td>{new Intl.NumberFormat("pt-BR").format(row.thirtyDays)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="seller-finance-note">As janelas são móveis até o momento da consulta. Orçamentos e pedidos diretos incluem todos os status atuais. Impressões refletem apenas registros visíveis para a loja; convites recusados, fechados ou cancelados não entram.</p>
        </section>}
      </main>
    </>
  );
}
