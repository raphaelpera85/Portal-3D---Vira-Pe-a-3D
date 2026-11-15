import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";
import { filterHomepageModelShowcase, filterModelShowcase, getModelAssetUrl, getRecommendedModels, getShowcaseFileLabel, getShowcaseModel, getShowcaseModelIds, modelShowcase, modelShowcaseCategories, type ShowcaseModel } from "./model-showcase";
import { MAX_OBJ_ARCHIVE_BYTES, MAX_OBJ_ARCHIVE_UNCOMPRESSED_BYTES, readObjModelArchive, readThreeMfPackage } from "./model-file";
import visualIndex from "./model-showcase-visual-index.json";
import gitModelAssets from "./git-model-assets.json";
import { getUnregisteredGitModelAssets } from "./creator-model-assets";

const models: ShowcaseModel[] = [
  { id: "owl", name: "Coruja descanso", category: "Suporte para Óculos", categorySlug: "suporte-para-oculos", image: "/modelos/coruja.png", filePath: "models/owl.3mf", tags: ["suporte", "óculos", "coruja"] },
  { id: "cat", name: "Gato articulado", category: "Chaveiros", categorySlug: "chaveiros", image: "/modelos/gato.png", filePath: "models/cat.3mf", tags: ["chaveiro", "gato", "articulado"] },
];

function listThreeMfFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listThreeMfFiles(filePath);
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".3mf") return [];
    return [path.relative(process.cwd(), filePath).split(path.sep).join("/")];
  });
}

describe("filterModelShowcase", () => {
  it("does not apply unrelated marketplace categories to homepage model previews", () => {
    expect(filterHomepageModelShowcase(models, "", "pets")).toEqual(models);
    expect(filterHomepageModelShowcase(models, "", "chaveiros")).toEqual([models[1]]);
  });

  it("keeps all included previews backed by image files in the three requested categories", () => {
    expect(modelShowcase).toHaveLength(90);
    expect(Object.fromEntries(modelShowcaseCategories.map(({ slug }) => [slug, modelShowcase.filter((model) => model.categorySlug === slug).length])))
      .toEqual({ "suporte-para-oculos": 7, chaveiros: 51, infantil: 8, "jogos-de-mesa": 3, diversos: 6, natal: 11, "acessorios-para-impressora-3d": 4 });
    expect(modelShowcase.every((model) => existsSync(path.join(process.cwd(), "public", model.image.slice(1))))).toBe(true);
    expect(modelShowcase.every((model) => /^models\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:3mf|zip)$/.test(model.filePath))).toBe(true);
    expect(modelShowcase.every((model) => existsSync(path.join(process.cwd(), model.filePath)))).toBe(true);
    expect(modelShowcase.filter(({ previewFilePath }) => previewFilePath).every(({ previewFilePath }) => /^models\/[a-z0-9]+(?:-[a-z0-9]+)*\.glb$/.test(previewFilePath!) && existsSync(path.join(process.cwd(), previewFilePath!)))).toBe(true);
    expect(new Set(modelShowcase.map((model) => model.filePath)).size).toBe(90);
    const allFiles = modelShowcase.flatMap((model) => [model.filePath, ...(model.downloads ?? []).map(({ filePath }) => filePath)]);
    expect(new Set(allFiles).size).toBe(118);
    expect(allFiles.every((filePath) => existsSync(path.join(process.cwd(), filePath)))).toBe(true);
    expect(modelShowcase.find(({ id }) => id === "9492febb5ebe")?.downloads).toHaveLength(2);
  });

  it("keeps the Git asset manifest complete while allowing newly added files to be registered", () => {
    const referencedFiles = modelShowcase.flatMap((model) => [model.filePath, ...(model.downloads ?? []).map(({ filePath }) => filePath)]);
    const referencedSet = [...new Set(referencedFiles.filter((filePath) => filePath.endsWith(".3mf")))].sort();
    const repositoryFiles = listThreeMfFiles(path.join(process.cwd(), "models")).sort();
    expect(referencedSet.every((filePath) => repositoryFiles.includes(filePath))).toBe(true);
    expect(gitModelAssets).toEqual(repositoryFiles);
    expect(getUnregisteredGitModelAssets()).toEqual([]);
    expect(getUnregisteredGitModelAssets([], ["models/new-model.3mf", "models/batman.3mf"])).toEqual(["models/new-model.3mf"]);
  });

  it("opens each newly recovered source model as a valid 3MF package", async () => {
    const recoveredAssets = [
      "models/drybox-single-v3-local.3mf",
      "models/gorros-papai-noel-oito-unidades.3mf",
      "models/grinch-topper-seis-copias.3mf",
      "models/grinch-wall-mount-local.3mf",
      "models/nossa-senhora-aparecida-meshy-duas-copias.3mf",
    ];

    for (const filePath of recoveredAssets) {
      const file = readFileSync(path.join(process.cwd(), filePath));
      await expect(readThreeMfPackage(new Uint8Array(file))).resolves.toHaveProperty("unit");
    }
  }, 20_000);

  it("opens and validates the textured Grinch OBJ archive from the source folder", async () => {
    const filePath = "models/grinch-lid-topper-textured.zip";
    const file = readFileSync(path.join(process.cwd(), filePath));
    expect(file.byteLength).toBeLessThanOrEqual(MAX_OBJ_ARCHIVE_BYTES);
    const contents = await readObjModelArchive(new Uint8Array(file));
    expect(contents.map(({ name }) => name).sort()).toEqual([
      "Meshy_AI_Grinch_Lid_Topper_20261113_image-to-3d-texture.mtl",
      "Meshy_AI_Grinch_Lid_Topper_20261113_image-to-3d-texture.obj",
      "Meshy_AI_Grinch_Lid_Topper_20261113_image-to-3d-texture.png",
    ]);
    expect(contents.reduce((total, item) => total + item.data.byteLength, 0)).toBeLessThanOrEqual(MAX_OBJ_ARCHIVE_UNCOMPRESSED_BYTES);
    expect(new TextDecoder().decode(contents.find(({ name }) => name.endsWith(".mtl"))!.data)).toContain("map_Kd Meshy_AI_Grinch_Lid_Topper_20261113_image-to-3d-texture.png");
    expect(modelShowcase.find(({ id }) => id === "grinch-tampa-texturizado")).toMatchObject({ filePath, previewFilePath: "models/grinch-lid-topper-preview.glb", name: "Topo de Tampa do Grinch · Texturizado" });
    const preview = readFileSync(path.join(process.cwd(), "models/grinch-lid-topper-preview.glb"));
    expect(preview.toString("ascii", 0, 4)).toBe("glTF");
    expect(preview.readUInt32LE(4)).toBe(2);
    expect(preview.readUInt32LE(8)).toBe(preview.byteLength);
  }, 20_000);

  it("rejects unsafe OBJ archive paths and undeclared companion files", async () => {
    const maliciousPath = zipSync({ "../outside.obj": new TextEncoder().encode("v 0 0 0") });
    await expect(readObjModelArchive(maliciousPath)).rejects.toThrow("caminho inválido");
    const missingTexture = zipSync({
      "model/model.obj": new TextEncoder().encode("mtllib model.mtl\n"),
      "model/model.mtl": new TextEncoder().encode("map_Kd missing.png\n"),
    });
    await expect(readObjModelArchive(missingTexture)).rejects.toThrow("não estão incluídos");
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
    expect(modelShowcase.find(({ name }) => name === "Grinch Wall Mount")?.downloads).toContainEqual({ label: "Versão da pasta local", filePath: "models/grinch-wall-mount-local.3mf" });
    expect(modelShowcase.find(({ name }) => name === "Drybox Single V3")?.downloads).toContainEqual({ label: "Versão da pasta local · V3", filePath: "models/drybox-single-v3-local.3mf" });
    expect(modelShowcase.find(({ name }) => name === "Grinch com Gorro de Natal")?.downloads).toContainEqual({ label: "Seis cópias do topo segmentado", filePath: "models/grinch-topper-seis-copias.3mf" });
    expect(modelShowcase.find(({ name }) => name === "Miniaturas de Gorro de Papai Noel")?.downloads).toContainEqual({ label: "Oito miniaturas multicoloridas", filePath: "models/gorros-papai-noel-oito-unidades.3mf" });
    expect(modelShowcase.find(({ name }) => name === "Nossa Senhora Aparecida")?.downloads).toContainEqual({ label: "Versão Meshy AI · placa com duas cópias", filePath: "models/nossa-senhora-aparecida-meshy-duas-copias.3mf" });
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
    expect(getModelAssetUrl("models/grinch-lid-topper-textured.zip")).toBe("https://raw.githubusercontent.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/main/models/grinch-lid-topper-textured.zip");
    expect(getModelAssetUrl("models/grinch-lid-topper-preview.glb")).toBe("https://raw.githubusercontent.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/main/models/grinch-lid-topper-preview.glb");
    expect(getModelAssetUrl("models/../../package.zip")).toBeNull();
    expect(getModelAssetUrl("models/unsafe.exe")).toBeNull();
    expect(getShowcaseFileLabel("models/grinch-lid-topper-textured.zip")).toBe("OBJ · ZIP");
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
