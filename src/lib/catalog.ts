export type CatalogProduct = {
  name: string;
  category: string;
  tags: string[];
  maker?: string;
  description?: string;
};

export function getCatalogEmptyState({ source, unavailable, query, category }: {
  source: "local" | "database";
  unavailable: boolean;
  query: string;
  category: string;
}) {
  if (unavailable) return "unavailable";
  if (query.trim() || category) return "no-results";
  return source === "database" ? "no-published-products" : "no-results";
}

export function filterProducts<T extends CatalogProduct>(
  products: T[],
  query: string,
  category: string,
) {
  const term = query.trim().toLocaleLowerCase("pt-BR");

  return products.filter((product) => {
    const matchesCategory = category === "Todos" || product.category === category;
    const matchesTerm =
      !term ||
      [product.name, product.category, product.maker ?? "", product.description ?? "", ...product.tags].some((value) =>
        value.toLocaleLowerCase("pt-BR").includes(term),
      );

    return matchesCategory && matchesTerm;
  });
}
