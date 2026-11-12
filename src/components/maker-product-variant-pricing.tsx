"use client";

import { useState } from "react";
import { expandProductVariantOptions, validateProductVariantOptions } from "@/lib/marketplace-validation";

type Row = { priceBrl: string; stockQuantity: string };
const optionKey = (options: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(options).sort(([a], [b]) => a.localeCompare(b))));

export function MakerProductVariantPricing({ optionsText, basePrice, fulfillmentMode, initialVariants = [] }: {
  optionsText: string;
  basePrice: string;
  fulfillmentMode: "ready_to_ship" | "made_to_order";
  initialVariants?: { options: Record<string, string>; priceBrl: number; stockQuantity: number | null }[];
}) {
  const options = validateProductVariantOptions(optionsText);
  const combinations = options ? expandProductVariantOptions(options) : null;
  const [values, setValues] = useState<Record<string, Row>>(() => Object.fromEntries(initialVariants.map((variant) => [
    optionKey(variant.options), { priceBrl: String(variant.priceBrl), stockQuantity: variant.stockQuantity == null ? "" : String(variant.stockQuantity) },
  ])));
  if (!options) return <p className="auth-notice is-error">Confira os grupos e as opções. Use pelo menos dois valores por grupo.</p>;
  if (!combinations) return <p className="auth-notice is-error">Este anúncio pode ter no máximo 100 combinações de variações.</p>;
  if (!combinations.length) return null;
  const rows = combinations.map((options) => ({
    options,
    key: optionKey(options),
    value: values[optionKey(options)] ?? { priceBrl: basePrice, stockQuantity: "" },
  }));
  const prices = rows.map(({ value }) => Number(value.priceBrl));
  const stocks = rows.map(({ value }) => Number(value.stockQuantity));
  const totalStock = fulfillmentMode === "ready_to_ship" && stocks.every(Number.isSafeInteger) ? stocks.reduce((sum, stock) => sum + stock, 0) : "";

  return <div className="maker-variant-pricing">
    <strong>Preço e estoque por variação</strong>
    <p>Informe o valor e, para pronta entrega, as unidades disponíveis em cada combinação.</p>
    {rows.map(({ options: selected, key, value }) => <fieldset key={key}>
      <legend>{Object.entries(selected).map(([name, choice]) => name + ": " + choice).join(" · ")}</legend>
      <label>Preço (R$)<input type="number" min="0.01" max="999999999" step="0.01" value={value.priceBrl}
        onChange={(event) => setValues((current) => ({ ...current, [key]: { ...value, priceBrl: event.target.value } }))} required /></label>
      {fulfillmentMode === "ready_to_ship" && <label>Unidades<input type="number" min="0" max="1000000" step="1" value={value.stockQuantity}
        onChange={(event) => setValues((current) => ({ ...current, [key]: { ...value, stockQuantity: event.target.value } }))} required /></label>}
    </fieldset>)}
    <input type="hidden" name="priceBrl" value={prices.every((price) => Number.isFinite(price) && price > 0) ? Math.min(...prices).toFixed(2) : ""} />
    {fulfillmentMode === "ready_to_ship" && <input type="hidden" name="stockQuantity" value={totalStock} />}
    <input type="hidden" name="variantPricing" value={JSON.stringify(rows.map(({ options, value }) => ({
      options, priceBrl: value.priceBrl, stockQuantity: fulfillmentMode === "ready_to_ship" ? value.stockQuantity : null,
    })))} />
    <small>O preço exibido no anúncio será o menor entre as variações. O estoque total é calculado pela soma das unidades.</small>
  </div>;
}
