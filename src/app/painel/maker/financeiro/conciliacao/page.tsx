import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getMercadoPagoSellerAccessToken } from "@/lib/mercado-pago-access-token.server";
import { formatBrl } from "@/lib/money";
import { hasReleaseReportReconciliationColumns, listReleaseReportPaymentReferences, reconcileReleaseReportCsv } from "@/lib/mercado-pago-release-reconciliation";
import { configureMercadoPagoReleaseReconciliation, requestMercadoPagoReleaseReport } from "../reconciliation-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata: Metadata = { title: "Conciliação financeira | ViraPeça 3D", robots: { index: false, follow: false } };

const resultMessages: Record<string, { message: string; error?: boolean }> = {
  "configuracao-nao-confirmada": { message: "Confirme a atualização das colunas do relatório para continuar.", error: true },
  "configuracao-pronta": { message: "O relatório de liberações já está preparado para a conciliação." },
  "configuracao-salva": { message: "Configuração salva. A geração automática do Mercado Pago permanece desativada." },
  "configuracao-falhou": { message: "O Mercado Pago não aceitou a configuração. Verifique a conexão OAuth e tente novamente.", error: true },
  "relatorio-indisponivel": { message: "Não foi possível consultar a configuração do relatório no Mercado Pago.", error: true },
  "conta-desconectada": { message: "Reconecte a conta Mercado Pago da loja antes de continuar.", error: true },
  "acesso-negado": { message: "Esta loja não está disponível para a conta autenticada.", error: true },
  "periodo-invalido": { message: "Escolha um intervalo passado válido de até 31 dias.", error: true },
  "configuracao-pendente": { message: "Prepare as colunas do relatório antes de solicitar a geração.", error: true },
  "geracao-falhou": { message: "O Mercado Pago não conseguiu iniciar este relatório. Confira os dados e tente novamente.", error: true },
  "geracao-solicitada": { message: "Solicitação enviada ao Mercado Pago. A geração é assíncrona; atualize a lista em alguns minutos." },
};

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asReports = (value: unknown) => {
  const results = asObject(value).results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((item) => {
    const row = asObject(item);
    if (!(typeof row.id === "string" || typeof row.id === "number") || !/^\d{1,30}$/.test(String(row.id))
      || typeof row.file_name !== "string" || !/^[a-zA-Z0-9._-]{1,250}\.csv$/i.test(row.file_name)) return [];
    return [{ id: String(row.id), fileName: row.file_name, beginDate: typeof row.begin_date === "string" ? row.begin_date : "",
      endDate: typeof row.end_date === "string" ? row.end_date : "", createdAt: typeof row.date_created === "string" ? row.date_created : "",
      status: typeof row.status === "string" ? row.status : "unknown" }];
  });
};

async function readLimitedText(response: Response, maxBytes: number) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function ReportSetupForm() {
  return <form className="auth-form" action={configureMercadoPagoReleaseReconciliation}>
    <label className="seller-refund-confirm"><input type="checkbox" name="confirmConfiguration" value="yes" required />Autorizo o ViraPeça a adicionar as colunas necessárias ao relatório de liberações desta conta Mercado Pago.</label>
    <p className="seller-finance-note">As colunas existentes e outras preferências serão mantidas. A configuração não ativa relatórios automáticos nem envia cópias por e-mail.</p>
    <button className="button button-secondary" type="submit">Preparar relatório para conciliação</button>
  </form>;
}

function GenerateReportForm() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  return <form className="auth-form release-report-form" action={requestMercadoPagoReleaseReport}>
    <label>Início do período<input type="date" name="from" defaultValue={from} max={today} required /></label>
    <label>Fim do período<input type="date" name="through" defaultValue={today} max={today} required /></label>
    <button className="button button-primary" type="submit">Solicitar relatório de liberações</button>
    <small>Máximo de 31 dias. O Mercado Pago gera o arquivo de forma assíncrona.</small>
  </form>;
}

export default async function MakerPaymentReconciliationPage({ searchParams }: { searchParams: Promise<{ resultado?: string; reportId?: string; fileName?: string }> }) {
  const params = await searchParams;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { data: store } = await actor.supabase.from("stores").select("id, name").eq("owner_user_id", actor.user.id).maybeSingle();
  if (!store) redirect("/painel/maker");

  let token: string | null = null;
  try { token = await getMercadoPagoSellerAccessToken(store.id); } catch { /* rendered below as a connection/setup state */ }
  let config: unknown = null; let reports: ReturnType<typeof asReports> = []; let providerUnavailable = false;
  if (token) {
    try {
      const [configResponse, reportResponse] = await Promise.all([
        fetch("https://api.mercadopago.com/v1/account/release_report/config", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" }),
        fetch(`https://api.mercadopago.com/v1/account/release_report/search?range=date_created&range_begin_date=${encodeURIComponent(new Date(Date.now() - 30 * 86_400_000).toISOString())}&range_end_date=${encodeURIComponent(new Date().toISOString())}&limit=20&offset=0`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" }),
      ]);
      if (configResponse.ok) config = await configResponse.json().catch(() => null);
      if (reportResponse.ok) reports = asReports(await reportResponse.json().catch(() => null));
      else if (reportResponse.status !== 404) providerUnavailable = true;
      if (!configResponse.ok && configResponse.status !== 404) providerUnavailable = true;
    } catch { providerUnavailable = true; }
  }

  let reconciliation: ReturnType<typeof reconcileReleaseReportCsv> = null;
  let detailError: string | null = null;
  if (params.reportId || params.fileName) {
    if (!token || !params.reportId || !/^\d{1,30}$/.test(params.reportId) || !params.fileName || !/^[a-zA-Z0-9._-]{1,250}\.csv$/i.test(params.fileName)) detailError = "Este arquivo não é válido para a conta conectada.";
    else try {
      const verifyUrl = new URL("https://api.mercadopago.com/v1/account/release_report/search");
      verifyUrl.searchParams.set("id", params.reportId); verifyUrl.searchParams.set("limit", "1"); verifyUrl.searchParams.set("offset", "0");
      const verified = await fetch(verifyUrl, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" });
      const verifiedRows = asReports(await verified.json().catch(() => null));
      if (!verified.ok || !verifiedRows.some((row) => row.id === params.reportId && row.fileName === params.fileName && ["processed", "enabled"].includes(row.status))) detailError = "O relatório ainda não está pronto ou não pertence à conta conectada.";
      else {
        const downloadUrl = `https://api.mercadopago.com/v1/account/release_report/${encodeURIComponent(params.fileName)}`;
        const download = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000), cache: "no-store", redirect: "error" });
        const size = Number(download.headers.get("content-length") ?? 0);
        if (!download.ok || size > 15_000_000) detailError = "Não foi possível ler o relatório. O arquivo excede o limite de 15 MB ou ainda está indisponível.";
        else {
          const csv = await readLimitedText(download, 15_000_000);
          if (csv === null) detailError = "O relatório excede o limite de 15 MB.";
          else {
            const references = listReleaseReportPaymentReferences(csv);
            if (!references) detailError = "O CSV não contém a coluna EXTERNAL_REFERENCE necessária para associar movimentos.";
            else {
              const { data: payments, error } = references.length ? await actor.supabase.from("seller_order_payments")
                .select("id, order_id, total_cents, marketplace_fee_cents, status").eq("store_id", store.id).in("id", references.slice(0, 5000)) : { data: [], error: null };
              if (error) detailError = "Não foi possível consultar os pagamentos internos da loja.";
              else {
                reconciliation = reconcileReleaseReportCsv(csv, payments ?? []);
                if (!reconciliation) detailError = "O CSV não contém as colunas financeiras necessárias para conciliar.";
                if (references.length > 5000 && reconciliation) reconciliation.providerReferenceCount = references.length;
              }
            }
          }
        }
      }
    } catch { detailError = "O Mercado Pago não respondeu durante a leitura do relatório."; }
  }

  const feedback = params.resultado ? resultMessages[params.resultado] : null;
  const total = (rows: NonNullable<typeof reconciliation>['reconciled'], field: "expectedGrossCents" | "reportedGrossCents" | "netCreditCents" | "netDebitCents" | "providerFeeCents") => rows.reduce((sum, row) => sum + row[field], 0);
  return <><SiteHeader /><main className="maker-dashboard shell maker-finance-page">
    <Link className="viewer-back-link" href="/painel/maker/financeiro">← Voltar ao financeiro</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">EXTRATO DO PROVEDOR</p><h1>Conciliação financeira · {store.name}</h1><p>Compare os movimentos liberados no Mercado Pago com as cobranças e comissões registradas pelo portal.</p></div>
    {feedback && <p className={`auth-notice ${feedback.error ? "is-error" : "is-success"}`} role="status">{feedback.message}</p>}
    {!token ? <section className="account-card maker-products-card"><h2>Conecte o Mercado Pago</h2><p>Conecte a conta da loja no painel do fabricante para consultar relatórios sem compartilhar tokens.</p><Link className="button button-secondary" href="/painel/maker#pagamentos">Abrir conexão Mercado Pago</Link></section>
      : providerUnavailable && <p className="auth-notice is-error" role="alert">Não foi possível consultar os relatórios do Mercado Pago agora. Tente novamente mais tarde.</p>}
    {token && <section className="account-card maker-products-card seller-finance-ledger">
      <span className="account-kicker">CONFIGURAÇÃO DA CONTA</span><h2>Relatório de liberações</h2>
      {hasReleaseReportReconciliationColumns(config) ? <><p>As colunas necessárias estão disponíveis. A configuração automática de relatórios permanece desativada.</p><GenerateReportForm /></>
        : <><p>Para fazer a comparação, o relatório precisa incluir referência do pedido, créditos, débitos, valor bruto e tarifa Mercado Pago. A geração continuará manual por período.</p><ReportSetupForm /></>}
    </section>}
    {token && <section className="account-card maker-products-card seller-finance-ledger"><span className="account-kicker">RELATÓRIOS RECENTES</span><h2>Arquivos dos últimos 30 dias</h2>
      {!reports.length ? <p>Nenhum relatório recente encontrado. Solicite um acima e atualize a página após alguns minutos.</p> : <ul className="seller-refund-list">{reports.map((report) => <li key={report.id}>
        <span>{report.status === "processed" || report.status === "enabled" ? "Pronto" : report.status} · {report.beginDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(report.beginDate)) : "início não informado"} – {report.endDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(report.endDate)) : "fim não informado"}</span>
        {report.createdAt && <small>Solicitado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(report.createdAt))}</small>}
        {(["processed", "enabled"].includes(report.status)) && <Link className="button button-secondary" href={`/painel/maker/financeiro/conciliacao?reportId=${encodeURIComponent(report.id)}&fileName=${encodeURIComponent(report.fileName)}`}>Conciliar este relatório</Link>}
      </li>)}</ul>}
    </section>}
    {params.reportId && <section className="account-card maker-products-card seller-finance-ledger"><span className="account-kicker">RESULTADO DO RELATÓRIO</span><h2>Comparação por referência do pedido</h2>
      {detailError ? <p className="auth-notice is-error" role="alert">{detailError}</p> : reconciliation ? <>
        <div className="seller-finance-summary"><article><span>Referências associadas</span><strong>{reconciliation.matchedPayments}</strong></article><article><span>Movimentos sem pagamento do portal</span><strong>{reconciliation.unlinkedMovements}</strong></article><article><span>Bruto esperado após comissão</span><strong>{formatBrl(total(reconciliation.reconciled, "expectedGrossCents") / 100)}</strong></article><article><span>Créditos líquidos do provedor</span><strong>{formatBrl((total(reconciliation.reconciled, "netCreditCents") - total(reconciliation.reconciled, "netDebitCents")) / 100)}</strong></article></div>
        <p className="seller-finance-note">A tabela associa a referência externa ao ID de pagamento interno da loja. Bruto e líquido têm bases diferentes; confira tarifas, saques, estornos e datas de liberação antes de interpretar diferenças. A conciliação não altera pagamentos nem saldo.</p>
        {reconciliation.providerReferenceCount > 5000 && <p className="auth-notice" role="status">O relatório contém {reconciliation.providerReferenceCount} referências; apenas as primeiras 5.000 foram consultadas no portal.</p>}
        {!reconciliation.reconciled.length ? <p>Nenhuma referência do arquivo corresponde a um pagamento desta loja.</p> : <div className="seller-finance-table-wrap"><table className="seller-finance-table"><caption className="sr-only">Movimentos Mercado Pago associados aos pagamentos da loja</caption><thead><tr><th>Pagamento / pedido</th><th>Status portal</th><th>Bruto esperado após comissão</th><th>Bruto Mercado Pago</th><th>Crédito líquido</th><th>Débitos</th><th>Tarifa Mercado Pago</th><th>Linhas</th></tr></thead><tbody>{reconciliation.reconciled.slice(0, 250).map((row) => <tr key={row.paymentId}><td><code>{row.paymentId}</code>{row.orderId && <small>{row.orderId}</small>}</td><td>{row.paymentStatus}</td><td>{formatBrl(row.expectedGrossCents / 100)}</td><td>{formatBrl(row.reportedGrossCents / 100)}</td><td>{formatBrl(row.netCreditCents / 100)}</td><td>{formatBrl(row.netDebitCents / 100)}</td><td>{formatBrl(row.providerFeeCents / 100)}</td><td>{row.providerRows}</td></tr>)}</tbody></table></div>}
        {reconciliation.reconciled.length > 250 && <p className="seller-finance-note">A tabela mostra as primeiras 250 referências; os totais incluem todas as referências associadas.</p>}
      </> : null}
    </section>}
    <p className="admin-metrics-note">O relatório vem diretamente da conta Mercado Pago vinculada à loja. Arquivos e tokens não são armazenados no ViraPeça. Esta comparação é informativa e não constitui extrato contábil ou confirmação de repasse.</p>
  </main></>;
}
