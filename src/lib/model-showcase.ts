import models from "./model-showcase-data.json";

export type ShowcaseModel = { id: string; name: string; category: string; categorySlug: string; image: string; filePath: string; tags: string[] };
export const modelShowcase = models as ShowcaseModel[];
export const modelShowcaseCategories = [
  { name: "Suporte para Óculos", slug: "suporte-para-oculos" },
  { name: "Chaveiros", slug: "chaveiros" },
  { name: "Infantil", slug: "infantil" },
  { name: "Jogos de mesa", slug: "jogos-de-mesa" },
  { name: "Diversos", slug: "diversos" },
  { name: "Natal", slug: "natal" },
  { name: "Acessórios para Impressoras 3D", slug: "acessorios-para-impressora-3d" },
] as const;

export function getShowcaseModel(id: string) {
  return modelShowcase.find((model) => model.id === id) ?? null;
}

const modelAssetBaseUrl = "https://raw.githubusercontent.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/main";

export function getModelAssetUrl(filePath: string) {
  if (!/^models\/[a-z0-9]+(?:-[a-z0-9]+)*\.3mf$/.test(filePath)) return null;
  return `${modelAssetBaseUrl}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

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
