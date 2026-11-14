import models from "./model-showcase-data.json";

export type ShowcaseModel = { id: string; name: string; category: string; categorySlug: string; image: string; filePath: string; tags: string[]; downloads?: { label: string; filePath: string }[] };
export const modelShowcase = models as ShowcaseModel[];
const modelAliases: Record<string, string> = {
  "ed02512a7e12": "803903c6b264", "842b11790cac": "254940e7f223", "ffcd1251d90c": "5e61567440ea",
  "917ef3dc290d": "6ad21ca46a99", "9be8503eefde": "a08d58a5f11e", "cb706de3adc8": "e752bde69af8",
  "bcde0a3aca26": "e752bde69af8", "a0988396307f": "e752bde69af8", "2efa9477c8b0": "b593314ca05c",
  "d4211589e816": "8d0a92160a0b", "54f47885f43c": "ca07717166b7", "30788cf83a54": "64a0f86f6baa",
};
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
  const canonicalId = modelAliases[id] ?? id;
  return modelShowcase.find((model) => model.id === canonicalId) ?? null;
}

export function getShowcaseModelIds(id: string) {
  const model = getShowcaseModel(id);
  return model ? [model.id, ...Object.entries(modelAliases).filter(([, canonicalId]) => canonicalId === model.id).map(([alias]) => alias)] : [];
}

const modelAssetBaseUrl = "https://raw.githubusercontent.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/main";

export function getModelAssetUrl(filePath: string) {
  if (!/^models\/[a-z0-9]+(?:-[a-z0-9]+)*\.3mf$/.test(filePath)) return null;
  return `${modelAssetBaseUrl}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// shortcut: category and tags only; personalize after users opt in to behavioral recommendations.
export function getRecommendedModels(model: ShowcaseModel, items: ShowcaseModel[] = modelShowcase) {
  const tags = new Set(model.tags.map(normalize));
  return items.filter((candidate) => candidate.id !== model.id)
    .map((candidate, index) => ({
      candidate,
      index,
      sameCategory: candidate.categorySlug === model.categorySlug,
      matchingTags: candidate.tags.filter((tag) => tags.has(normalize(tag))).length,
    }))
    .filter(({ sameCategory, matchingTags }) => sameCategory || matchingTags > 0)
    .sort((a, b) => Number(b.sameCategory) - Number(a.sameCategory) || b.matchingTags - a.matchingTags || a.index - b.index)
    .slice(0, 4)
    .map(({ candidate }) => candidate);
}

export function filterModelShowcase(items: ShowcaseModel[], query = "", category = "") {
  const groups = query.split(/\s+OR\s+/i).map((group) => normalize(group.replace(/["']/g, "")).trim().split(/\s+/).filter(Boolean)).filter((group) => group.length > 0);
  return items.filter((model) => {
    if (category && model.categorySlug !== category) return false;
    if (!groups.length) return true;
    const searchable = normalize([model.name, model.category, ...model.tags, ...(model.downloads ?? []).map(({ label }) => label)].join(" "));
    return groups.some((group) => group.every((term) => searchable.includes(term)));
  });
}
