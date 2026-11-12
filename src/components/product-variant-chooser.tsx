"use client";

import { useSearchParams } from "next/navigation";
import { findProductVariant, ProductVariantFields } from "@/components/product-variant-fields";
import type { ProductVariant } from "@/lib/products";

export function ProductVariantChooser({ variants, options }: { variants: ProductVariant[]; options: Record<string, string[]> }) {
  const searchParams = useSearchParams();
  const variant = variants.find((item) => item.id === searchParams.get("variant")) ?? variants[0] ?? null;
  const selected = variant?.options ?? Object.fromEntries(Object.entries(options).map(([name, values]) => [name, values[0] ?? ""]));

  function updateSelection(next: Record<string, string>) {
    const nextVariant = findProductVariant(variants, next);
    if (!nextVariant) return;
    const params = new URLSearchParams(window.location.search);
    params.set("variant", nextVariant.id);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}${window.location.hash}`);
  }

  const stock = variant?.stockQuantity;
  return <section className="auth-form product-variant-chooser" aria-label="Opções do produto">
    <p className="account-kicker">ESCOLHA UMA OPÇÃO</p>
    <ProductVariantFields options={options} selected={selected} onChange={updateSelection} />
    {variant && <p className="quote-small-note" aria-live="polite">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(variant.priceBrl)} · {stock == null ? "produzido sob encomenda" : stock === 0 ? "sem unidades em estoque" : `${stock} em estoque`}</p>}
  </section>;
}
