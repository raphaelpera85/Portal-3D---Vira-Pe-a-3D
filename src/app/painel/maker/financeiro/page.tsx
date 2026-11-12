import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MakerChargebackEvidenceForm } from "@/components/maker-chargeback-evidence-form";
import { formatBrl } from "@/lib/money";
import { summarizeSellerPayments } from "@/lib/seller-payment-ledger";
import { getUserWithRole } from "@/lib/auth-role.server";
import { refundSellerOrderPayment } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata: Metadata = { title: "Financeiro do fabricante | ViraPeça 3D", robots: { index: false, follow: false } };

const statusLabels: Record<string, string> = {
  creating: "Preparando checkout", pending: "Aguardando pagamento", paid: "Pago",
  partially_refunded: "Reembolso parcial", refunded: "Reembolsado", charged_back: "Contestado", failed: "Falhou",
  expired: "Expirado", cancelled: "Cancelado",
};
const refundStatusLabels: Record<string, string> = { pending: "Aguardando Mercado Pago", processed: "Reembolso processado", failed: "Não processado" };
const chargebackStatusLabels: Record<string, string> = { in_process: "Em análise", settled: "Decidido", reimbursed: "Valor devolvido ao vendedor" };
const documentationStatusLabels: Record<string, string> = {
  pending: "Documentos pendentes", review_pending: "Documentos em análise", valid: "Documentos aceitos",
  invalid: "Documentos recusados", not_supplied: "Prazo de envio encerrado", not_applicable: "Envio não aplicável",
};
const resultMessages: Record<string, string> = {
  "reembolso-enviado": "Solicitação de reembolso enviada ao Mercado Pago. Confira o status atualizado abaixo.",
  "reembolso-pendente": "O Mercado Pago ainda não confirmou o resultado. Envie novamente o mesmo valor para repetir com segurança, ou confira a conta conectada.",
  "reembolso-falhou": "O Mercado Pago não processou o reembolso. Confira o status da cobrança na conta conectada antes de tentar outra vez.",
  "reembolso-valor-invalido": "O valor excede o saldo ainda disponível para reembolso ou está fora do formato aceito.",
  "reembolso-indisponivel": "Esta cobrança não está disponível para reembolso agora.",
  "reembolso-dados-invalidos": "Revise o valor e confirme o reembolso antes de enviar.",
  "reembolso-acesso-negado": "Entre com a conta autorizada da loja para solicitar um reembolso.",
  "reembolso-configurar": "O serviço financeiro do portal ainda não está configurado.",
};

export default async function MakerFinancePage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const { resultado } = await searchParams;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id, name").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker");

  const { data: payments, error } = await actor.supabase.from("seller_order_payments")
    .select("id, order_id, purchase_request_id, custom_print_request_id, total_cents, marketplace_fee_cents, provider_order_id, status, provider_status, created_at, refunds:seller_order_refunds(id, amount_cents, status, provider_status, created_at), chargebacks:seller_order_chargebacks(case_id, case_status, reason, amount_cents, currency, coverage_applied, documentation_status, documentation_deadline, documents_sent_at, documents_count)")
    .eq("store_id", store.id).order("created_at", { ascending: false }).limit(500);
  const rows = payments ?? [];
  const summary = summarizeSellerPayments(rows);

  return (
    <>
      <SiteHeader />
      <main className="maker-dashboard shell maker-finance-page">
        <Link className="viewer-back-link" href="/painel/maker">← Voltar ao painel</Link>
        <div className="account-heading maker-dashboard-heading"><p className="eyebrow">FINANCEIRO DA LOJA</p><h1>{store.name}</h1><p>Registro das cobranças e das comissões da plataforma nos últimos 500 pagamentos.</p></div>
        {resultado && resultMessages[resultado] && <p className={`auth-notice ${resultado === "reembolso-enviado" ? "is-success" : "is-error"}`} role="status">{resultMessages[resultado]}</p>}
        {error ? <section className="account-card maker-products-card"><h2>Extrato indisponível</h2><p>Não foi possível consultar pagamentos. Confira as migrações financeiras e tente novamente.</p></section> : <>
          <section className="seller-finance-summary" aria-label="Resumo de pagamentos confirmados">
            <article><span>Pagamentos confirmados</span><strong>{summary.paidCount}</strong></article>
            <article><span>Valor cobrado</span><strong>{formatBrl(summary.paidTotalCents / 100)}</strong></article>
            <article><span>Comissão ViraPeça</span><strong>{formatBrl(summary.marketplaceFeeCents / 100)}</strong></article>
            <article><span>Após comissão da plataforma</span><strong>{formatBrl(summary.beforeProviderFeesCents / 100)}</strong></article>
          </section>
          <p className="seller-finance-note">Os totais acima incluem apenas pagamentos no status “Pago”. O valor após comissão ainda não desconta as tarifas do Mercado Pago. Reembolsos e contestações aparecem no extrato sem serem somados como recebimento confirmado.</p>
          <section className="account-card maker-products-card seller-finance-ledger">
            <span className="account-kicker">MOVIMENTAÇÕES</span><h2>Pagamentos recentes</h2>
            {summary.pendingCount + summary.partiallyRefundedCount + summary.refundedCount + summary.chargedBackCount > 0 && <p className="quote-small-note">Aguardando: {summary.pendingCount} · reembolsos parciais: {summary.partiallyRefundedCount} · reembolsados: {summary.refundedCount} · contestados: {summary.chargedBackCount}</p>}
            {rows.length === 0 ? <p>Nenhum pagamento registrado para esta loja.</p> : <div className="seller-finance-table-wrap"><table className="seller-finance-table"><caption className="sr-only">Últimos 500 pagamentos da loja</caption><thead><tr><th scope="col">Data</th><th scope="col">Origem</th><th scope="col">Status</th><th scope="col">Valor cobrado</th><th scope="col">Comissão</th><th scope="col">Após comissão</th><th scope="col">Reembolsos</th><th scope="col">Contestações</th></tr></thead><tbody>{rows.map((payment) => {
              const source = payment.custom_print_request_id ? "Impressão personalizada" : payment.purchase_request_id ? "Compra direta ou arquivo digital" : "Pedido do carrinho";
              const status = statusLabels[payment.status] ?? "Status desconhecido";
              const refunds = Array.isArray(payment.refunds) ? payment.refunds : [];
              const chargebacks = Array.isArray(payment.chargebacks) ? payment.chargebacks : [];
              const reservedRefundCents = refunds.filter((refund) => refund.status === "pending" || refund.status === "processed")
                .reduce((sum, refund) => sum + Number(refund.amount_cents), 0);
              const refundableCents = Math.max(0, Number(payment.total_cents) - reservedRefundCents);
              return <tr key={payment.id}><td><time dateTime={payment.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(payment.created_at))}</time></td><td>{source}</td><td><span className={`quote-status status-${payment.status}`}>{status}</span>{payment.provider_status && <small className="quote-small-note">Mercado Pago: {payment.provider_status.split(":").at(-1)}</small>}</td><td>{formatBrl(Number(payment.total_cents) / 100)}</td><td>{formatBrl(Number(payment.marketplace_fee_cents) / 100)}</td><td>{formatBrl((Number(payment.total_cents) - Number(payment.marketplace_fee_cents)) / 100)}</td><td>
                {refunds.length > 0 && <ul className="seller-refund-list">{refunds.map((refund) => <li key={refund.id}><span className={`quote-status status-${refund.status}`}>{refundStatusLabels[refund.status] ?? "Status de reembolso desconhecido"}</span><span>{formatBrl(Number(refund.amount_cents) / 100)}</span>{refund.provider_status && <small>{refund.provider_status}</small>}</li>)}</ul>}
                {refundableCents > 0 && payment.provider_order_id && ["paid", "partially_refunded"].includes(payment.status) && <details className="seller-refund-details"><summary>Solicitar reembolso</summary><form action={refundSellerOrderPayment} className="seller-refund-form"><label>Valor disponível: {formatBrl(refundableCents / 100)}<input name="amount" type="number" min="0.01" max={(refundableCents / 100).toFixed(2)} step="0.01" defaultValue={(refundableCents / 100).toFixed(2)} required /></label><label className="seller-refund-confirm"><input type="checkbox" name="confirmRefund" value="yes" required />Confirmo o envio deste valor ao comprador.</label><input type="hidden" name="paymentId" value={payment.id} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><button className="button button-secondary" type="submit">Enviar ao Mercado Pago</button></form></details>}
                {refundableCents === 0 && refunds.length > 0 && <small>Saldo para reembolso esgotado.</small>}
              </td><td>
                {chargebacks.length > 0 ? <ul className="seller-refund-list">{chargebacks.map((chargeback) => <li key={chargeback.case_id}>
                  <span>{chargebackStatusLabels[chargeback.case_status] ?? "Atualização recebida"} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: chargeback.currency }).format(Number(chargeback.amount_cents) / 100)}</span>
                  {chargeback.reason && <small>{chargeback.reason}</small>}
                  <span className={`quote-status status-${chargeback.documentation_status}`}>{documentationStatusLabels[chargeback.documentation_status] ?? "Status de documentos desconhecido"}</span>
                  {chargeback.documentation_status === "pending" && <small>Envie os comprovantes pelo portal antes do prazo indicado abaixo.</small>}
                  {chargeback.documents_sent_at && <small>{chargeback.documents_count} comprovante(s) enviados em <time dateTime={chargeback.documents_sent_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(chargeback.documents_sent_at))}</time>.</small>}
                  {chargeback.documentation_deadline && <small>Prazo: <time dateTime={chargeback.documentation_deadline}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(chargeback.documentation_deadline))}</time></small>}
                  {chargeback.coverage_applied !== null && <small>{chargeback.coverage_applied ? "Decisão favorável ao vendedor" : "Decisão desfavorável ao vendedor"}</small>}
                  {chargeback.documentation_status === "pending" && <MakerChargebackEvidenceForm caseId={chargeback.case_id} />}
                </li>)}</ul> : "—"}
              </td></tr>;
            })}</tbody></table></div>}
            <p className="seller-finance-note">A coluna “Após comissão” não representa repasse líquido nem saldo disponível. O Mercado Pago processa o split e apresenta as tarifas, disponibilidade e extratos da conta conectada.</p>
          </section>
        </>}
      </main>
    </>
  );
}
