import { describe, expect, it } from "vitest";
import { getAssignableCategoryParentIds, getProductCategoryLabels } from "./product-category-hierarchy";

const categories = [
  { id: "root", name: "Pets", parent_id: null, active: true },
  { id: "branch", name: "Cães", parent_id: "root", active: true },
  { id: "leaf", name: "Poodles", parent_id: "branch", active: true },
  { id: "other", name: "Chaveiros", parent_id: null, active: true },
  { id: "inactive", name: "Inativa", parent_id: null, active: false },
];

describe("assignable product category parents", () => {
  it("excludes the category and its descendants to prevent hierarchy cycles", () => {
    expect(getAssignableCategoryParentIds("branch", categories)).toEqual(["root", "other"]);
  });

  it("offers every active category when creating a new category", () => {
    expect(getAssignableCategoryParentIds(null, categories)).toEqual(["root", "branch", "leaf", "other"]);
  });

  it("shows the parent path for categories so buyers and makers can distinguish subcategories", () => {
    expect(getProductCategoryLabels(categories)).toEqual(new Map([
      ["root", "Pets"], ["branch", "Pets / Cães"], ["leaf", "Pets / Cães / Poodles"],
      ["other", "Chaveiros"], ["inactive", "Inativa"],
    ]));
  });

  it("stops at malformed cycles instead of looping", () => {
    expect(getProductCategoryLabels([
      { id: "a", parent_id: "b", name: "A" },
      { id: "b", parent_id: "a", name: "B" },
    ])).toEqual(new Map([["a", "B / A"], ["b", "A / B"]]));
  });
});
