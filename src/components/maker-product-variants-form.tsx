import { updateProductVariants } from "@/app/painel/maker/actions";
import { MakerProductVariantPricing } from "@/components/maker-product-variant-pricing";

export function MakerProductVariantsForm({ productId, options, fulfillmentMode, variants, basePrice }: {
  productId: string;
  options: Record<string, string[]>;
  fulfillmentMode: "ready_to_ship" | "made_to_order";
  variants: { options: Record<string, string>; priceBrl: number; stockQuantity: number | null }[];
  basePrice: string;
}) {
  const optionsText = Object.entries(options).map(([name, values]) => name + ": " + values.join(", ")).join("\n");
  const lowestPrice = variants.length ? String(Math.min(...variants.map((variant) => variant.priceBrl))) : basePrice;
  return <form className="maker-variant-pricing-form" action={updateProductVariants}>
    <input type="hidden" name="productId" value={productId} />
    <MakerProductVariantPricing optionsText={optionsText} basePrice={lowestPrice} fulfillmentMode={fulfillmentMode} initialVariants={variants} />
    <button className="button button-secondary" type="submit">Salvar preços e estoque</button>
  </form>;
}
