"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addProductToCart } from "@/app/carrinho/actions";
import type { ProductVariant } from "@/lib/products";

export function ProductCartForm({ slug, authorized, result, stockQuantity = null, variantOptions = {}, variants = [] }: { slug: string; authorized: boolean; result?: string; stockQuantity?: number | null; variantOptions?: Record<string, string[]>; variants?: ProductVariant[] }) {
  const selectedVariantId = useSearchParams().get("variant");
  const variant = variants.find((item) => item.id === selectedVariantId) ?? variants[0] ?? null;
  const selected = variant?.options ?? Object.fromEntries(Object.entries(variantOptions).map(([name, values]) => [name, values[0] ?? ""]));
  const available = variants.length ? variant?.stockQuantity ?? (variant ? null : 0) : stockQuantity;
  const soldOut = available === 0;
  return <div className="product-detail-note quote-request-card">
    <strong>Adicionar ao carrinho</strong>
    {soldOut && <p className="quote-inline-error" role="status">Esta combinação está sem unidades disponíveis.</p>}
    {result === "erro" && <p className="quote-inline-error" role="alert">Não foi possível adicionar este produto. Tente novamente.</p>}
    {result === "indisponivel" && <p className="quote-inline-error" role="alert">Este produto não está disponível para compra no momento.</p>}
    {stockQuantity !== 0 && (authorized ? <form className="auth-form" action={addProductToCart}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="variantOptions" value={JSON.stringify(selected)} />
      <input type="hidden" name="variantId" value={variant?.id ?? ""} />
      {variant && <p className="quote-small-note">Preço desta opção: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(variant.priceBrl)}{available != null ? " · " + available + " em estoque" : " · sob encomenda"}</p>}
      <label>Quantidade<input name="quantity" type="number" min="1" max={available == null ? 100 : Math.max(1, Math.min(100, available))} defaultValue="1" disabled={soldOut || (variants.length > 0 && !variant)} required /></label>
      <button className="button button-primary" type="submit" disabled={soldOut || (variants.length > 0 && !variant)}>Adicionar ao carrinho</button>
      <p className="quote-small-note">Você poderá reunir produtos de várias lojas. O pedido só será enviado após confirmar o carrinho.</p>
    </form> : <p><Link href="/conta">Entre em uma conta de comprador</Link> para adicionar este produto.</p>)}
  </div>;
}
