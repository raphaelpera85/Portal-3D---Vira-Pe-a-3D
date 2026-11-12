import Link from "next/link";
import { requestProductQuote } from "@/app/orcamentos/actions";

export function ProductQuoteRequestForm({ slug, authorized, result }: { slug: string; authorized: boolean; result?: string }) {
  return <div className="product-detail-note quote-request-card">
    <strong>Solicitar orçamento</strong>
    {result === "erro" && <p className="quote-inline-error" role="alert">Não foi possível enviar o pedido. Confira os dados e tente novamente.</p>}
    {result === "indisponivel" && <p className="quote-inline-error" role="alert">Este produto não está aceitando pedidos de orçamento no momento.</p>}
    {authorized ? <form className="auth-form" action={requestProductQuote}>
      <input type="hidden" name="slug" value={slug} />
      <label>Quantidade<input name="quantity" type="number" min="1" max="100" defaultValue="1" required /></label>
      <label>Detalhes ou personalizações<textarea name="customization" maxLength={2000} rows={3} placeholder="Medidas, cores, material ou outras informações" /></label>
      <label>Prazo desejado (opcional)<input name="dueDate" type="date" /></label>
      <button className="button button-primary" type="submit">Enviar pedido</button>
      <p className="quote-small-note">O fabricante enviará uma proposta. Nenhum pagamento será cobrado nesta etapa.</p>
    </form> : <p><Link href="/conta">Entre em uma conta de comprador</Link> para pedir um orçamento.</p>}
  </div>;
}
