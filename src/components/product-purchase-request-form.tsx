import Link from "next/link";
import { requestProductPurchase } from "@/app/orcamentos/actions";

export function ProductPurchaseRequestForm({ slug, authorized, result, stockQuantity = null }: { slug: string; authorized: boolean; result?: string; stockQuantity?: number | null }) {
  return <div className="product-detail-note quote-request-card">
    <strong>Solicitar compra</strong>
    {stockQuantity === 0 && <p className="quote-inline-error" role="status">Sem unidades disponíveis no momento.</p>}
    {result === "erro" && <p className="quote-inline-error" role="alert">Não foi possível enviar a solicitação. Confira os dados e tente novamente.</p>}
    {result === "indisponivel" && <p className="quote-inline-error" role="alert">Este produto não está disponível para solicitação no momento.</p>}
    {stockQuantity !== 0 && (authorized ? <form className="auth-form" action={requestProductPurchase}>
      <input type="hidden" name="slug" value={slug} />
      <label>Quantidade<input name="quantity" type="number" min="1" max={stockQuantity == null ? 100 : Math.min(100, stockQuantity)} defaultValue="1" required /></label>
      <label>Observações ou personalização<textarea name="customization" maxLength={2000} rows={3} placeholder="Detalhes para o fabricante (opcional)" /></label>
      <label>Prazo desejado (opcional)<input name="dueDate" type="date" /></label>
      <button className="button button-primary" type="submit">Enviar solicitação ao fabricante</button>
      <p className="quote-small-note">O fabricante confirmará a disponibilidade. A solicitação não cobra nem reserva pagamento.</p>
    </form> : <p><Link href="/conta">Entre em uma conta de comprador</Link> para solicitar este produto.</p>)}
  </div>;
}
