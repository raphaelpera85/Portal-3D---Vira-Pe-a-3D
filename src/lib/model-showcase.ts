import models from "./model-showcase-data.json";

export type ShowcaseModel = { id: string; name: string; category: string; categorySlug: string; image: string; tags: string[] };
export const modelShowcase = models as ShowcaseModel[];

const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function filterModelShowcase(items: ShowcaseModel[], query = "", category = "") {
  const groups = query.split(/\s+OR\s+/i).map((group) => normalize(group.replace(/["']/g, "")).trim().split(/\s+/).filter(Boolean)).filter((group) => group.length > 0);
  return items.filter((model) => {
    if (category && model.categorySlug !== category) return false;
    if (!groups.length) return true;
    const searchable = normalize([model.name, model.category, ...model.tags].join(" "));
    return groups.some((group) => group.every((term) => searchable.includes(term)));
  });
}
