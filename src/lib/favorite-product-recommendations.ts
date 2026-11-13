import type { Product } from "./products";

const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function getFavoriteProductRecommendations(favorites: Product[], candidates: Product[]) {
  if (!favorites.length) return [];

  const favoriteIds = new Set(favorites.map(({ id }) => id));
  const categories = new Set(favorites.map(({ category }) => normalize(category)).filter(Boolean));
  const tags = new Set(favorites.flatMap(({ tags: itemTags }) => itemTags.map(normalize)).filter(Boolean));

  return candidates.filter((candidate) => !candidate.demo && !favoriteIds.has(candidate.id))
    .map((candidate, index) => ({
      candidate,
      index,
      score: (categories.has(normalize(candidate.category)) ? 3 : 0)
        + candidate.tags.map(normalize).filter((tag) => tags.has(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 4)
    .map(({ candidate }) => candidate);
}
