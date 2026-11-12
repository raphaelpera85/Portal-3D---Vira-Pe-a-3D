import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { formatBrl } from "@/lib/money";
import { summarizeSellerPayments } from "@/lib/seller-payment-ledger";
import { getUserWithRole } from "@/lib/auth-role.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Financeiro do fabricante | ViraPeça 3D", robots: { index: false, follow: false } };

const statusLabels: Record<string, string> = {
  creating: "Preparando checkout", pending: "Aguardando pagamento", paid: "Pago",
  partially_refunded: "Reembolso parcial", refunded: "Reembolsado", failed: "Falhou",
  expired: "Expirado", cancelled: "Cancelado",
};

export default async function MakerFinancePage() {
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id, name").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker");

  const { data: payments, error } = await actor.supabase.from("seller_order_payments")
    .select("id, order_id, purchase_request_id, custom_print_request_id, total_cents, marketplace_fee_cents, status, created_at")
    .eq("store_id", store.id).order("created_at", { ascending: false }).limit(500);
  const rows = payments ?? [];
  const summary = summarizeSellerPayments(rows);

  return (
    <>
      <SiteHeader />
      <main className="maker-dashboard shell maker-finance-page">
        <Link className="viewer-back-link" href="/painel/maker">← Voltar ao painel</Link>
        <div className="account-heading maker-dashboard-heading"><p className="eyebrow">FINANCEIRO DA LOJA</p><h1>{store.name}</h1><p>Registro das cobranças e das comissões da plataforma nos últimos 500 pagamentos.</p></div>
        {error ? <section className="account-card maker-products-card"><h2>Extrato indisponível</h2><p>Não foi possível consultar pagamentos. Confira as migrações financeiras e tente novamente.</p></section> : <>
          <section className="seller-finance-summary" aria-label="Resumo de pagamentos confirmados">
            <article><span>Pagamentos confirmados</span><strong>{summary.paidCount}</strong></article>
            <article><span>Valor cobrado</span><strong>{formatBrl(summary.paidTotalCents / 100)}</strong></article>
            <article><span>Comissão ViraPeça</span><strong>{formatBrl(summary.marketplaceFeeCents / 100)}</strong></article>
            <article><span>Após comissão da plataforma</span><strong>{formatBrl(summary.beforeProviderFeesCents / 100)}</strong></article>
          </section>
          <p className="seller-finance-note">Os totais acima incluem apenas pagamentos no status “Pago”. O valor após comissão ainda não desconta as tarifas do Mercado Pago. Reembolsos parciais e totais aparecem no extrato sem serem somados como recebimento confirmado.</p>
          <section className="account-card maker-products-card seller-finance-ledger">
            <span className="account-kicker">MOVIMENTAÇÕES</span><h2>Pagamentos recentes</h2>
            {summary.pendingCount + summary.partiallyRefundedCount + summary.refundedCount > 0 && <p className="quote-small-note">Aguardando: {summary.pendingCount} · reembolsos parciais: {summary.partiallyRefundedCount} · reembolsados: {summary.refundedCount}</p>}
            {rows.length === 0 ? <p>Nenhum pagamento registrado para esta loja.</p> : <div className="seller-finance-table-wrap"><table className="seller-finance-table"><caption className="sr-only">Últimos 500 pagamentos da loja</caption><thead><tr><th scope="col">Data</th><th scope="col">Origem</th><th scope="col">Status</th><th scope="col">Valor cobrado</th><th scope="col">Comissão</th><th scope="col">Após comissão</th></tr></thead><tbody>{rows.map((payment) => {
              const source = payment.custom_print_request_id ? "Impressão personalizada" : payment.purchase_request_id ? "Compra direta ou arquivo digital" : "Pedido do carrinho";
              const status = statusLabels[payment.status] ?? "Status desconhecido";
              return <tr key={payment.id}><td><time dateTime={payment.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(payment.created_at))}</time></td><td>{source}</td><td><span className={`quote-status status-${payment.status}`}>{status}</span></td><td>{formatBrl(Number(payment.total_cents) / 100)}</td><td>{formatBrl(Number(payment.marketplace_fee_cents) / 100)}</td><td>{formatBrl((Number(payment.total_cents) - Number(payment.marketplace_fee_cents)) / 100)}</td></tr>;
            })}</tbody></table></div>}
            <p className="seller-finance-note">A coluna “Após comissão” não representa repasse líquido nem saldo disponível. O Mercado Pago processa o split e apresenta as tarifas, disponibilidade e extratos da conta conectada.</p>
          </section>
        </>}
      </main>
    </>
  );
}
