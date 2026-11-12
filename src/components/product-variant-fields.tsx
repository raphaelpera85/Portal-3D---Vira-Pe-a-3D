"use client";

import type { ProductVariant } from "@/lib/products";

export function ProductVariantFields({ options, selected, onChange }: {
  options: Record<string, string[]>;
  selected: Record<string, string>;
  onChange: (selected: Record<string, string>) => void;
}) {
  return <>
    {Object.entries(options).map(([name, values]) => <label key={name}>{name}
      <select required value={selected[name] ?? ""} onChange={(event) => onChange({ ...selected, [name]: event.target.value })}>
        {values.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>)}
  </>;
}

export function findProductVariant(variants: ProductVariant[], selection: Record<string, string>) {
  const key = (options: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(options).sort(([a], [b]) => a.localeCompare(b))));
  const selectedKey = key(selection);
  return variants.find((variant) => key(variant.options) === selectedKey) ?? null;
}
