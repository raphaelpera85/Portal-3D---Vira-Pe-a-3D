"use client";

import { useState, type FormEvent } from "react";

type ReleaseRow = {
  paymentId: string; orderId: string | null; paymentStatus: string; providerRows: number;
  expectedGrossCents: number; reportedGrossCents: number; netCreditCents: number; netDebitCents: number; providerFeeCents: number;
};
type ReleaseReport = { reconciled: ReleaseRow[]; unlinkedMovements: number; unlinkedNetCents: number; matchedPayments: number; providerReferenceCount: number };

const errorLabels: Record<string, string> = {
  administrator_required: "Acesso restrito à administração.", authentication_required: "Entre na conta administrativa.",
  invalid_report: "O arquivo não é um relatório CSV válido do Mercado Pago.", report_too_large: "O relatório excede o limite permitido.",
  report_unavailable: "Não foi possível consultar os pagamentos. Tente novamente.",
};
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function AdminReleaseReconciliation() {
  const [report, setReport] = useState<ReleaseReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setReport(null);
    try {
      const response = await fetch("/api/admin/financeiro/repasses", { method: "POST", body: new FormData(event.currentTarget) });
      const data = await response.json();
      if (!response.ok) setError(errorLabels[data.error] ?? "Não foi possível conciliar o relatório.");
      else setReport(data as ReleaseReport);
    } catch { setError("Não foi possível enviar o relatório. Confira sua conexão e tente novamente."); }
    finally { setBusy(false); }
  }

  return <section className="admin-review-section" aria-labelledby="release-report-title">
    <div className="admin-section-title"><span className="account-kicker">CONCILIAÇÃO INFORMATIVA</span><h2 id="release-report-title">Relatório do Mercado Pago</h2></div>
    <p>Compare liberações do provedor com pagamentos registrados no portal. O arquivo é processado em memória e não fica armazenado.</p>
    <form className="admin-period-report-form" onSubmit={submit}>
      <label htmlFor="release-report-file">Arquivo CSV<input id="release-report-file" name="report" type="file" accept=".csv,text/csv" required /></label>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Conciliando…" : "Conciliar relatório"}</button>
      <span>Limite: 1 MB e 5.000 referências.</span>
    </form>
    {error && <p className="auth-notice is-error" role="alert">{error}</p>}
    {report && <>
      <div className="admin-overview-grid" aria-label="Resumo da conciliação">
        <article className="admin-overview-card"><span>Pagamentos correspondidos</span><strong>{report.matchedPayments}</strong><small>Referências encontradas no portal</small></article>
        <article className="admin-overview-card"><span>Referências no relatório</span><strong>{report.providerReferenceCount}</strong><small>Identificadores válidos no arquivo</small></article>
        <article className="admin-overview-card"><span>Movimentos sem vínculo</span><strong>{report.unlinkedMovements}</strong><small>Valor líquido {money(report.unlinkedNetCents)}</small></article>
      </div>
      {report.reconciled.length > 0 && <div className="seller-finance-table-wrap">
        <table className="seller-activity-report-table"><caption className="sr-only">Comparação dos pagamentos do portal com movimentos do relatório do provedor</caption><thead><tr><th>Pedido</th><th>Status</th><th>Bruto esperado após comissão*</th><th>Bruto informado</th><th>Créditos</th><th>Débitos</th><th>Taxas</th></tr></thead>
          <tbody>{report.reconciled.slice(0, 250).map((row) => <tr key={row.paymentId}>
            <th title={row.paymentId}>{row.orderId ?? row.paymentId.slice(0, 8)}</th><td>{row.paymentStatus}</td><td>{money(row.expectedGrossCents)}</td>
            <td>{money(row.reportedGrossCents)}</td><td>{money(row.netCreditCents)}</td><td>{money(row.netDebitCents)}</td><td>{money(row.providerFeeCents)}</td>
          </tr>)}</tbody>
        </table>
        {report.reconciled.length > 250 && <p className="admin-metrics-note">Exibindo os primeiros 250 de {report.reconciled.length} pagamentos correspondidos.</p>}
      </div>}
      <p className="admin-metrics-note">*Estimativa calculada pelo valor do pagamento menos a comissão registrada. Este relatório é informativo; não confirma liquidação ou transferência bancária. A tabela mostra pagamentos encontrados, sem identificar um repasse como concluído.</p>
    </>}
  </section>;
}
