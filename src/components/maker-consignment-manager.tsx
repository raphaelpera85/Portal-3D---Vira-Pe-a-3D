import { formatBrl } from "@/lib/money";
import { summarizeConsignment, type ConsignmentMovement } from "@/lib/consignment";
import { createMakerConsignmentItem, recordMakerConsignmentMovement } from "@/app/painel/maker/actions";

type ConsignmentItem = {
  id: string;
  establishment: string;
  product_name: string;
  unit_cost_brl: number | string;
  sale_price_brl: number | string;
  commission_percent: number | string;
  created_at: string;
  movements: Array<{ id: string; movement_type: ConsignmentMovement["movementType"]; quantity: number; notes: string; created_at: string }>;
};

const labels = { delivered: "Entregue", sold: "Vendido", returned: "Devolvido", lost: "Perdido" };
const money = (cents: number) => formatBrl(cents / 100);

export function MakerConsignmentManager({ items, products, error }: {
  items: ConsignmentItem[];
  products: Array<{ id: string; name: string }>;
  error: boolean;
}) {
  const summarized = items.map((item) => ({
    item,
    report: summarizeConsignment({
      unitCostBrl: Number(item.unit_cost_brl), salePriceBrl: Number(item.sale_price_brl), commissionPercent: Number(item.commission_percent),
    }, item.movements.map(({ movement_type, quantity }) => ({ movementType: movement_type, quantity }))),
  }));
  const establishments = [...new Set(items.map((item) => item.establishment))].map((name) => ({
    name,
    report: summarized.filter(({ item }) => item.establishment === name).reduce((total, { report }) => ({
      delivered: total.delivered + report.delivered,
      sold: total.sold + report.sold,
      returned: total.returned + report.returned,
      lost: total.lost + report.lost,
      receivableCents: total.receivableCents + report.receivableCents,
      estimatedResultCents: total.estimatedResultCents + report.estimatedResultCents,
    }), { delivered: 0, sold: 0, returned: 0, lost: 0, receivableCents: 0, estimatedResultCents: 0 }),
  }));

  return <section className="account-card maker-products-card" id="consignacoes">
    <span className="account-kicker">VENDAS EM CONSIGNAÇÃO</span>
    <h2>Controle por estabelecimento</h2>
    <p>Registre entregas, vendas, devoluções e perdas. Valores a receber e resultados são estimativas; nenhum repasse é processado pelo portal.</p>
    {error && <p className="auth-notice is-error" role="alert">O controle de consignação ficará disponível após aplicar a migração 015.</p>}
    {establishments.length > 0 && <div className="consignment-reports" aria-label="Resumo de consignações por estabelecimento">
      {establishments.map(({ name, report }) => <article className="consignment-report" key={name}>
        <h3>{name}</h3>
        <dl>
          <div><dt>Entregues</dt><dd>{report.delivered}</dd></div>
          <div><dt>Vendidas</dt><dd>{report.sold}</dd></div>
          <div><dt>Devolvidas</dt><dd>{report.returned}</dd></div>
          <div><dt>Perdidas</dt><dd>{report.lost}</dd></div>
          <div><dt>A receber</dt><dd>{money(report.receivableCents)}</dd></div>
          <div><dt>Resultado estimado</dt><dd>{money(report.estimatedResultCents)}</dd></div>
        </dl>
      </article>)}
    </div>}
    <form action={createMakerConsignmentItem} className="consignment-create-form">
      <h3>Registrar novo lote</h3>
      <div className="consignment-form-grid">
        <label>Estabelecimento<input name="establishment" minLength={2} maxLength={120} required placeholder="Ex.: Loja do Centro" /></label>
        {products.length > 0 && <label>Produto publicado<select name="productId" defaultValue=""><option value="">Informar o nome manualmente</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>}
        <label>Produto<input name="productName" minLength={2} maxLength={200} placeholder={products.length ? "Obrigatório se não selecionar acima" : "Nome do produto"} required={products.length === 0} /></label>
        <label>Quantidade entregue<input name="quantity" type="number" min="1" max="100000" step="1" defaultValue="1" required /></label>
        <label>Custo por peça<input name="unitCostBrl" type="number" min="0" max="1000000" step="0.01" inputMode="decimal" required /></label>
        <label>Preço de venda por peça<input name="salePriceBrl" type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" required /></label>
        <label>Comissão do estabelecimento<input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="0" required /></label>
      </div>
      <button className="button button-primary" type="submit">Registrar entrega</button>
    </form>
    {error ? null : summarized.length === 0 ? <p className="price-history-empty">Os lotes em consignação aparecerão aqui.</p> : <div className="consignment-items">
      {summarized.map(({ item, report }) => <article className="consignment-item" key={item.id}>
        <div className="consignment-item-heading"><div><span>{item.establishment}</span><h3>{item.product_name}</h3><small>Entregue inicialmente em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(item.created_at))}</small></div><strong>{report.inStock} em estoque</strong></div>
        <dl className="consignment-item-stats">
          <div><dt>Entregues</dt><dd>{report.delivered}</dd></div>
          <div><dt>Vendidas</dt><dd>{report.sold}</dd></div>
          <div><dt>Devolvidas</dt><dd>{report.returned}</dd></div>
          <div><dt>Perdidas</dt><dd>{report.lost}</dd></div>
          <div><dt>Preço unitário</dt><dd>{formatBrl(item.sale_price_brl)}</dd></div>
          <div><dt>Comissão</dt><dd>{Number(item.commission_percent).toLocaleString("pt-BR")}%</dd></div>
          <div><dt>A receber</dt><dd>{money(report.receivableCents)}</dd></div>
          <div><dt>Resultado estimado</dt><dd>{money(report.estimatedResultCents)}</dd></div>
        </dl>
        <form action={recordMakerConsignmentMovement} className="consignment-movement-form">
          <input type="hidden" name="itemId" value={item.id} />
          <label>Movimentação<select name="movementType" defaultValue="sold"><option value="sold">Venda</option><option value="delivered">Nova entrega</option><option value="returned">Devolução</option><option value="lost">Perda</option></select></label>
          <label>Quantidade<input name="quantity" type="number" min="1" max="100000" step="1" defaultValue="1" required /></label>
          <label>Observação<input name="notes" maxLength={500} placeholder="Opcional" /></label>
          <button className="button button-secondary" type="submit">Registrar movimentação</button>
        </form>
        <details className="consignment-movement-history"><summary>Histórico de movimentações ({item.movements.length})</summary><ul>{item.movements.map((movement) => <li key={movement.id}><span>{labels[movement.movement_type]} · {movement.quantity} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(movement.created_at))}</span>{movement.notes && <small>{movement.notes}</small>}</li>)}</ul></details>
      </article>)}
    </div>}
  </section>;
}
