import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { filterModelShowcase, getShowcaseModel, modelShowcase, type ShowcaseModel } from "./model-showcase";

const models: ShowcaseModel[] = [
  { id: "owl", name: "Coruja descanso", category: "Suporte para Óculos", categorySlug: "suporte-para-oculos", image: "/modelos/coruja.png", filePath: "models/owl.3mf", tags: ["suporte", "óculos", "coruja"] },
  { id: "cat", name: "Gato articulado", category: "Chaveiros", categorySlug: "chaveiros", image: "/modelos/gato.png", filePath: "models/cat.3mf", tags: ["chaveiro", "gato", "articulado"] },
];

describe("filterModelShowcase", () => {
  it("keeps all included previews backed by image files in the three requested categories", () => {
    expect(modelShowcase).toHaveLength(76);
    expect(Object.fromEntries(["suporte-para-oculos", "chaveiros", "infantil"].map((slug) => [slug, modelShowcase.filter((model) => model.categorySlug === slug).length])))
      .toEqual({ "suporte-para-oculos": 8, chaveiros: 61, infantil: 7 });
    expect(modelShowcase.every((model) => existsSync(path.join(process.cwd(), "public", model.image.slice(1))))).toBe(true);
    expect(modelShowcase.every((model) => /^models\/[a-f0-9]{64}\.3mf$/.test(model.filePath))).toBe(true);
    expect(new Set(modelShowcase.map((model) => model.filePath)).size).toBe(74);
  });

  it("opens a model by id and returns no model for unknown ids", () => {
    expect(getShowcaseModel(modelShowcase[0].id)).toBe(modelShowcase[0]);
    expect(getShowcaseModel("missing-model")).toBeNull();
  });

  it("matches accent-insensitive names and tags within the selected category", () => {
    expect(filterModelShowcase(models, "oculos", "suporte-para-oculos").map((model) => model.id)).toEqual(["owl"]);
    expect(filterModelShowcase(models, "gato", "suporte-para-oculos")).toEqual([]);
  });

  it("supports OR terms returned by image recognition", () => {
    expect(filterModelShowcase(models, '"pug" OR "gato"', "").map((model) => model.id)).toEqual(["cat"]);
  });
});
