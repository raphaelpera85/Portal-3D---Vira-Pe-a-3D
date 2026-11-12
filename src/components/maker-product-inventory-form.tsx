"use client";

import { useState } from "react";
import { updateProductInventory } from "@/app/painel/maker/actions";

export function MakerProductInventoryForm({ product }: { product: {
  id: string; price_mode: "fixed" | "from" | "quote"; fulfillment_mode: "ready_to_ship" | "made_to_order" | "quote";
  stock_quantity: number | null; preparation_days: number | null;
} }) {
  const [mode, setMode] = useState(product.fulfillment_mode);
  if (product.price_mode === "quote") return <p className="product-inventory-note">Disponibilidade confirmada após análise do orçamento.</p>;
  return <form className="maker-product-inventory" action={updateProductInventory}>
    <input type="hidden" name="productId" value={product.id} />
    <label>Atendimento<select name="fulfillmentMode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="made_to_order">Sob encomenda</option><option value="ready_to_ship">Pronta entrega</option></select></label>
    {mode === "ready_to_ship" && <label>Unidades disponíveis<input name="stockQuantity" type="number" min="0" max="1000000" step="1" defaultValue={product.stock_quantity ?? ""} required /></label>}
    <label>Prazo de preparação (dias)<input name="preparationDays" type="number" min="0" max="365" step="1" defaultValue={product.preparation_days ?? ""} /></label>
    <button className="button button-secondary" type="submit">Salvar disponibilidade</button>
  </form>;
}
