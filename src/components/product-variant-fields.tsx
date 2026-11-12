"use client";

import { useState } from "react";

type VariantOptions = Record<string, string[]>;
type VariantSelection = Record<string, string>;

export function ProductVariantFields({ options }: { options: VariantOptions }) {
  const groups = Object.entries(options);
  const [selected, setSelected] = useState<VariantSelection>(() => Object.fromEntries(groups.map(([name, values]) => [name, values[0] ?? ""])));

  // shortcut: choices share product price and aggregate stock; upgrade when SKU-level pricing or stock is required.
  return <>
    <input type="hidden" name="variantOptions" value={JSON.stringify(selected)} />
    {groups.map(([name, values]) => <label key={name}>{name}
      <select required value={selected[name] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [name]: event.target.value }))}>
        {values.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>)}
  </>;
}
