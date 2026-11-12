import Link from "next/link";
import { addProductToCart } from "@/app/carrinho/actions";

export function ProductCartForm({ slug, authorized, result, stockQuantity = null }: { slug: string; authorized: boolean; result?: string; stockQuantity?: number | null }) {
  return <div className="product-detail-note quote-request-card">
    <strong>Adicionar ao carrinho</strong>
    {stockQuantity === 0 && <p className="quote-inline-error" role="status">Sem unidades disponíveis no momento.</p>}
    {result === "erro" && <p className="quote-inline-error" role="alert">Não foi possível adicionar este produto. Tente novamente.</p>}
    {result === "indisponivel" && <p className="quote-inline-error" role="alert">Este produto não está disponível para compra no momento.</p>}
    {stockQuantity !== 0 && (authorized ? <form className="auth-form" action={addProductToCart}>
      <input type="hidden" name="slug" value={slug} />
      <label>Quantidade<input name="quantity" type="number" min="1" max={stockQuantity == null ? 100 : Math.min(100, stockQuantity)} defaultValue="1" required /></label>
      <button className="button button-primary" type="submit">Adicionar ao carrinho</button>
      <p className="quote-small-note">Você poderá reunir produtos de várias lojas. O pedido só será enviado após confirmar o carrinho.</p>
    </form> : <p><Link href="/conta">Entre em uma conta de comprador</Link> para adicionar este produto.</p>)}
  </div>;
}
