"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { requestProductPurchase } from "@/app/orcamentos/actions";
import type { ProductVariant } from "@/lib/products";

export function ProductPurchaseRequestForm({ slug, authorized, result, stockQuantity = null, variantOptions = {}, variants = [] }: { slug: string; authorized: boolean; result?: string; stockQuantity?: number | null; variantOptions?: Record<string, string[]>; variants?: ProductVariant[] }) {
  const selectedVariantId = useSearchParams().get("variant");
  const variant = variants.find((item) => item.id === selectedVariantId) ?? variants[0] ?? null;
  const selected = variant?.options ?? Object.fromEntries(Object.entries(variantOptions).map(([name, values]) => [name, values[0] ?? ""]));
  const available = variants.length ? variant?.stockQuantity ?? (variant ? null : 0) : stockQuantity;
  const soldOut = available === 0;
  return <div className="product-detail-note quote-request-card">
    <strong>Solicitar compra</strong>
    {soldOut && <p className="quote-inline-error" role="status">Esta combinação está sem unidades disponíveis.</p>}
    {result === "erro" && <p className="quote-inline-error" role="alert">Não foi possível enviar a solicitação. Confira os dados e tente novamente.</p>}
    {result === "indisponivel" && <p className="quote-inline-error" role="alert">Este produto não está disponível para solicitação no momento.</p>}
    {stockQuantity !== 0 && (authorized ? <form className="auth-form" action={requestProductPurchase}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="variantOptions" value={JSON.stringify(selected)} />
      <input type="hidden" name="variantId" value={variant?.id ?? ""} />
      {variant && <p className="quote-small-note">Preço desta opção: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(variant.priceBrl)}{available != null ? " · " + available + " em estoque" : " · sob encomenda"}</p>}
      <label>Quantidade<input name="quantity" type="number" min="1" max={available == null ? 100 : Math.max(1, Math.min(100, available))} defaultValue="1" disabled={soldOut || (variants.length > 0 && !variant)} required /></label>
      <label>Observações ou personalização<textarea name="customization" maxLength={2000} rows={3} placeholder="Detalhes para o fabricante (opcional)" /></label>
      <label>Prazo desejado (opcional)<input name="dueDate" type="date" /></label>
      <button className="button button-primary" type="submit" disabled={soldOut || (variants.length > 0 && !variant)}>Enviar solicitação ao fabricante</button>
      <p className="quote-small-note">O fabricante confirmará a disponibilidade. A solicitação não cobra nem reserva pagamento.</p>
    </form> : <p><Link href="/conta">Entre em uma conta de comprador</Link> para solicitar este produto.</p>)}
  </div>;
}
