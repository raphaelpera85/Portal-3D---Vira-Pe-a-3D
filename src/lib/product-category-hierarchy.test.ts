import { describe, expect, it } from "vitest";
import { getAssignableCategoryParentIds } from "./product-category-hierarchy";

const categories = [
  { id: "root", parent_id: null, active: true },
  { id: "branch", parent_id: "root", active: true },
  { id: "leaf", parent_id: "branch", active: true },
  { id: "other", parent_id: null, active: true },
  { id: "inactive", parent_id: null, active: false },
];

describe("assignable product category parents", () => {
  it("excludes the category and its descendants to prevent hierarchy cycles", () => {
    expect(getAssignableCategoryParentIds("branch", categories)).toEqual(["root", "other"]);
  });

  it("offers every active category when creating a new category", () => {
    expect(getAssignableCategoryParentIds(null, categories)).toEqual(["root", "branch", "leaf", "other"]);
  });
});
