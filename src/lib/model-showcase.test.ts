import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { filterModelShowcase, getModelAssetUrl, getRecommendedModels, getShowcaseModel, getShowcaseModelIds, modelShowcase, modelShowcaseCategories, type ShowcaseModel } from "./model-showcase";
import visualIndex from "./model-showcase-visual-index.json";

const models: ShowcaseModel[] = [
  { id: "owl", name: "Coruja descanso", category: "Suporte para Óculos", categorySlug: "suporte-para-oculos", image: "/modelos/coruja.png", filePath: "models/owl.3mf", tags: ["suporte", "óculos", "coruja"] },
  { id: "cat", name: "Gato articulado", category: "Chaveiros", categorySlug: "chaveiros", image: "/modelos/gato.png", filePath: "models/cat.3mf", tags: ["chaveiro", "gato", "articulado"] },
];

describe("filterModelShowcase", () => {
  it("keeps all included previews backed by image files in the three requested categories", () => {
    expect(modelShowcase).toHaveLength(89);
    expect(Object.fromEntries(modelShowcaseCategories.map(({ slug }) => [slug, modelShowcase.filter((model) => model.categorySlug === slug).length])))
      .toEqual({ "suporte-para-oculos": 7, chaveiros: 51, infantil: 8, "jogos-de-mesa": 3, diversos: 6, natal: 10, "acessorios-para-impressora-3d": 4 });
    expect(modelShowcase.every((model) => existsSync(path.join(process.cwd(), "public", model.image.slice(1))))).toBe(true);
    expect(modelShowcase.every((model) => /^models\/[a-z0-9]+(?:-[a-z0-9]+)*\.3mf$/.test(model.filePath))).toBe(true);
    expect(modelShowcase.every((model) => existsSync(path.join(process.cwd(), model.filePath)))).toBe(true);
    expect(new Set(modelShowcase.map((model) => model.filePath)).size).toBe(89);
    const allFiles = modelShowcase.flatMap((model) => [model.filePath, ...(model.downloads ?? []).map(({ filePath }) => filePath)]);
    expect(new Set(allFiles).size).toBe(108);
    expect(allFiles.every((filePath) => existsSync(path.join(process.cwd(), filePath)))).toBe(true);
    expect(modelShowcase.find(({ id }) => id === "9492febb5ebe")?.downloads).toHaveLength(2);
  });

  it("opens a model by id and returns no model for unknown ids", () => {
    expect(getShowcaseModel(modelShowcase[0].id)).toBe(modelShowcase[0]);
    expect(getShowcaseModel("missing-model")).toBeNull();
    expect(getShowcaseModel("ed02512a7e12")?.id).toBe("803903c6b264");
    expect(getShowcaseModelIds("803903c6b264")).toEqual(["803903c6b264", "ed02512a7e12"]);
    expect(modelShowcase.find(({ name }) => name === "Batman"))
      .toMatchObject({ name: "Batman", tags: ["chaveiro", "batman", "dc", "homem-morcego"] });
  });

  it("groups repeated preview cards while keeping every 3MF file available as a version", () => {
    expect(modelShowcase.find(({ name }) => name === "Gatos Flexi · Chaveiros")?.downloads).toHaveLength(3);
    expect(modelShowcase.find(({ name }) => name === "Presépio Exclusivo")?.downloads).toContainEqual({ label: "Versão final", filePath: "models/presepio-exclusivo-final.3mf" });
    expect(modelShowcase.find(({ name }) => name === "Suporte para Óculos de Gato")?.downloads).toContainEqual({ label: "Versão original", filePath: "models/cat.3mf" });
  });

  it("does not show exact duplicate previews twice in the same category", () => {
    const keys = visualIndex.map(({ categorySlug, hash }) => `${categorySlug}:${hash}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("finds grouped models by the names of their color and file versions", () => {
    expect(filterModelShowcase(modelShowcase, "cinza", "chaveiros").map(({ id }) => id)).toContain("e752bde69af8");
    expect(filterModelShowcase(modelShowcase, "tricolor", "chaveiros").map(({ id }) => id)).toEqual(expect.arrayContaining(["5e61567440ea", "a08d58a5f11e"]));
    expect(filterModelShowcase(modelShowcase, "versão final", "natal").map(({ id }) => id)).toContain("ca07717166b7");
  });

  it("builds safe public GitHub URLs for model previews and downloads", () => {
    expect(getModelAssetUrl("models/batman.3mf"))
      .toBe("https://raw.githubusercontent.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/main/models/batman.3mf");
    expect(getModelAssetUrl("models/../../.env")).toBeNull();
    expect(getModelAssetUrl("https://attacker.example/model.3mf")).toBeNull();
  });

  it("matches accent-insensitive names and tags within the selected category", () => {
    expect(filterModelShowcase(models, "oculos", "suporte-para-oculos").map((model) => model.id)).toEqual(["owl"]);
    expect(filterModelShowcase(models, "gato", "suporte-para-oculos")).toEqual([]);
  });

  it("supports OR terms returned by image recognition", () => {
    expect(filterModelShowcase(models, '"pug" OR "gato"', "").map((model) => model.id)).toEqual(["cat"]);
  });

  it("recommends same-category models first, then models with matching tags", () => {
    const related: ShowcaseModel[] = [
      { ...models[0], id: "same-category-and-tags", tags: ["suporte", "óculos"] },
      { ...models[0], id: "same-category-only", tags: ["vaso"] },
      { ...models[1], id: "shared-tag-other-category", tags: ["óculos"] },
      { ...models[1], id: "unrelated", tags: ["dragão"] },
    ];

    expect(getRecommendedModels(models[0], [models[0], ...related]).map(({ id }) => id))
      .toEqual(["same-category-and-tags", "same-category-only", "shared-tag-other-category"]);
  });
});
