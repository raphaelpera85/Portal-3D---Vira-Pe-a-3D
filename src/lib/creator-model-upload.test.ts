import { describe, expect, it } from "vitest";
import { isCreatorModelUploadPath, normalizeCreatorModelUpload } from "./creator-model-upload";

const ownerId = "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7";
const id = "4d06021fc27c";

describe("creator model uploads", () => {
  it("accepts a bounded 3MF file name and preserves its display name", () => {
    expect(normalizeCreatorModelUpload({ name: "Meu modelo.3mf", size: 1024 })).toEqual({ name: "Meu modelo.3mf", size: 1024 });
  });

  it.each([
    { name: "modelo.stl", size: 10 },
    { name: "../modelo.3mf", size: 10 },
    { name: "modelo.3mf", size: 0 },
    { name: "modelo.3mf", size: 50 * 1024 * 1024 + 1 },
  ])("rejects invalid upload metadata: $name / $size", (file) => {
    expect(normalizeCreatorModelUpload(file)).toBeNull();
  });

  it("accepts only the owner's generated submission path", () => {
    expect(isCreatorModelUploadPath(ownerId, `${ownerId}/${id}.3mf`, id)).toBe(true);
    expect(isCreatorModelUploadPath(ownerId, `another-user/${id}.3mf`, id)).toBe(false);
    expect(isCreatorModelUploadPath(ownerId, `${ownerId}/other-file.3mf`, id)).toBe(false);
    expect(isCreatorModelUploadPath(ownerId, `${ownerId}/${id}.stl`, id)).toBe(false);
  });
});
