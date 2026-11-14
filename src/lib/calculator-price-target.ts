type PriceTargetProduct = { id: string; canApplyPrice: boolean; variants: readonly { id: string }[] };

export function getCalculatorProductPrefill<T extends PriceTargetProduct>(products: readonly T[], requestedId: string | string[] | undefined) {
  if (typeof requestedId !== "string") return null;
  const product = products.find((item) => item.id === requestedId && item.canApplyPrice);
  return product ? { productId: product.id, priceTargetId: product.variants.length ? "" : product.id } : null;
}
