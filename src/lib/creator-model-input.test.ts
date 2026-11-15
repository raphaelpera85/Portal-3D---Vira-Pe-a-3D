import { describe, expect, it } from "vitest";
import { validateCreatorModelDetails, validateCreatorModelSubmission } from "./creator-model-input";

const valid = {
  name: "Dragão articulado",
  categorySlug: "infantil",
  assetPath: "models/dragao-articulado.3mf",
  tags: "dragão, articulado, brinquedo",
  creatorName: "Raphael",
  sourceUrl: "https://example.com/modelo",
  rightsConfirmed: "on",
};

describe("validateCreatorModelSubmission", () => {
  it("validates upload metadata without requiring a Git asset path", () => {
    expect(validateCreatorModelDetails(valid)).toEqual({
      name: "Dragão articulado", categorySlug: "infantil", tags: ["dragão", "articulado", "brinquedo"],
      creatorName: "Raphael", sourceUrl: valid.sourceUrl,
    });
    expect(validateCreatorModelDetails({ ...valid, rightsConfirmed: "" })).toBeNull();
  });

  it("normalizes a valid submission against available Git assets", () => {
    expect(validateCreatorModelSubmission(valid, [valid.assetPath])).toEqual({
      name: "Dragão articulado", categorySlug: "infantil", assetPath: valid.assetPath,
      tags: ["dragão", "articulado", "brinquedo"], creatorName: "Raphael", sourceUrl: valid.sourceUrl,
    });
  });

  it("rejects an asset not in Git, a mismatched category, or missing rights confirmation", () => {
    expect(validateCreatorModelSubmission(valid, [])).toBeNull();
    expect(validateCreatorModelSubmission({ ...valid, categorySlug: "inexistente" }, [valid.assetPath])).toBeNull();
    expect(validateCreatorModelSubmission({ ...valid, rightsConfirmed: "" }, [valid.assetPath])).toBeNull();
  });

  it("rejects unsafe source URLs and duplicate or excessive tags", () => {
    expect(validateCreatorModelSubmission({ ...valid, sourceUrl: "javascript:alert(1)" }, [valid.assetPath])).toBeNull();
    expect(validateCreatorModelSubmission({ ...valid, tags: "dragão, dragão" }, [valid.assetPath])).toBeNull();
    expect(validateCreatorModelSubmission({ ...valid, tags: Array.from({ length: 13 }, (_, i) => `tag${i}`).join(",") }, [valid.assetPath])).toBeNull();
  });
});
