import { describe, expect, it } from "vitest";
import { validateFavoriteChange } from "./favorites";

describe("favorite changes", () => {
  it("accepts only a product UUID and an explicit favorite state", () => {
    expect(validateFavoriteChange({ productId: "89abcdef-1234-4123-8123-123456789abc", favorite: "true" }))
      .toEqual({ productId: "89abcdef-1234-4123-8123-123456789abc", favorite: true });
    expect(validateFavoriteChange({ productId: "not-a-uuid", favorite: "true" })).toBeNull();
    expect(validateFavoriteChange({ productId: "89abcdef-1234-4123-8123-123456789abc", favorite: "yes" })).toBeNull();
  });
});
