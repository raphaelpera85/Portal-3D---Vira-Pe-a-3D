import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { filterModelShowcase, getModelAssetUrl, getRecommendedModels, getShowcaseModel, modelShowcase, modelShowcaseCategories, type ShowcaseModel } from "./model-showcase";

const models: ShowcaseModel[] = [
  { id: "owl", name: "Coruja descanso", category: "Suporte para Óculos", categorySlug: "suporte-para-oculos", image: "/modelos/coruja.png", filePath: "models/owl.3mf", tags: ["suporte", "óculos", "coruja"] },
  { id: "cat", name: "Gato articulado", category: "Chaveiros", categorySlug: "chaveiros", image: "/modelos/gato.png", filePath: "models/cat.3mf", tags: ["chaveiro", "gato", "articulado"] },
];

describe("filterModelShowcase", () => {
  it("keeps all included previews backed by image files in the three requested categories", () => {
    expect(modelShowcase).toHaveLength(94);
    expect(Object.fromEntries(modelShowcaseCategories.map(({ slug }) => [slug, modelShowcase.filter((model) => model.categorySlug === slug).length])))
      .toEqual({ "suporte-para-oculos": 8, chaveiros: 60, infantil: 7, "jogos-de-mesa": 3, diversos: 4, natal: 7, "acessorios-para-impressora-3d": 5 });
    expect(modelShowcase.every((model) => existsSync(path.join(process.cwd(), "public", model.image.slice(1))))).toBe(true);
    expect(modelShowcase.every((model) => /^models\/[a-z0-9]+(?:-[a-z0-9]+)*\.3mf$/.test(model.filePath))).toBe(true);
    expect(modelShowcase.every((model) => existsSync(path.join(process.cwd(), model.filePath)))).toBe(true);
    expect(new Set(modelShowcase.map((model) => model.filePath)).size).toBe(94);
  });

  it("opens a model by id and returns no model for unknown ids", () => {
    expect(getShowcaseModel(modelShowcase[0].id)).toBe(modelShowcase[0]);
    expect(getShowcaseModel("missing-model")).toBeNull();
    expect(modelShowcase.find(({ name }) => name === "Batman"))
      .toMatchObject({ name: "Batman", tags: ["chaveiro", "batman", "dc", "homem-morcego"] });
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
