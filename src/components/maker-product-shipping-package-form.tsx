"use client";

import { updateProductShippingPackage } from "@/app/painel/maker/actions";

export function MakerProductShippingPackageForm({ product }: { product: {
  id: string; package_weight_g: number | string | null; package_length_cm: number | string | null;
  package_width_cm: number | string | null; package_height_cm: number | string | null;
} }) {
  return <form className="maker-product-package-form" action={updateProductShippingPackage}>
    <input type="hidden" name="productId" value={product.id} />
    <fieldset className="shipping-package-fields"><legend>Embalagem do produto</legend><small>Medidas externas e peso com a peça protegida.</small><div>
      <label>Peso (g)<input name="packageWeightG" type="number" min="1" max="100000" step="1" defaultValue={product.package_weight_g ?? ""} /></label>
      <label>Comprimento (cm)<input name="packageLengthCm" type="number" min="0.1" max="500" step="0.01" defaultValue={product.package_length_cm ?? ""} /></label>
      <label>Largura (cm)<input name="packageWidthCm" type="number" min="0.1" max="500" step="0.01" defaultValue={product.package_width_cm ?? ""} /></label>
      <label>Altura (cm)<input name="packageHeightCm" type="number" min="0.1" max="500" step="0.01" defaultValue={product.package_height_cm ?? ""} /></label>
    </div></fieldset>
    <button className="button button-secondary" type="submit">Salvar embalagem</button>
  </form>;
}
