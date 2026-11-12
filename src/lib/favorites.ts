export type FavoriteChange = { productId: string; favorite: boolean };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateFavoriteChange(values: Record<string, unknown>): FavoriteChange | null {
  if (typeof values.productId !== "string" || !uuidPattern.test(values.productId)
    || (values.favorite !== "true" && values.favorite !== "false")) return null;
  return { productId: values.productId, favorite: values.favorite === "true" };
}
