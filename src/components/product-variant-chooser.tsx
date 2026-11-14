"use client";

import { useSearchParams } from "next/navigation";
import { findProductVariant, ProductVariantFields } from "@/components/product-variant-fields";
import type { ProductVariant } from "@/lib/products";

export function getSelectedProductVariant(variants: ProductVariant[], selectedId: string | null) {
  return variants.find((item) => item.id === selectedId) ?? variants[0] ?? null;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ProductVariantSummary({ variants, priceLabel, availabilityLabel, showAvailability = true }: {
  variants: ProductVariant[];
  priceLabel: string;
  availabilityLabel: string;
  showAvailability?: boolean;
}) {
  const variant = getSelectedProductVariant(variants, useSearchParams().get("variant"));
  const stock = variant?.stockQuantity;
  const availability = variant
    ? stock == null ? "Produzido sob encomenda" : stock === 0 ? "Sem unidades disponíveis" : `${stock} unidade${stock === 1 ? "" : "s"} em estoque`
    : availabilityLabel;

  return <div aria-live="polite">
    <p className="product-detail-price">{variant ? currency.format(variant.priceBrl) : priceLabel}</p>
    {showAvailability && <p className="product-availability">{availability}</p>}
  </div>;
}

export function ProductVariantChooser({ variants, options }: { variants: ProductVariant[]; options: Record<string, string[]> }) {
  const searchParams = useSearchParams();
  const variant = getSelectedProductVariant(variants, searchParams.get("variant"));
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
