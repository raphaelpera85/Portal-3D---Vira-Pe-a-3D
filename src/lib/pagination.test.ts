import { describe, expect, it } from "vitest";
import { getPaginationRedirectPage } from "./pagination";

describe("getPaginationRedirectPage", () => {
  it("redirects a page beyond the final result page", () => {
    expect(getPaginationRedirectPage(9, 3)).toBe(3);
  });

  it("keeps valid and empty-result pages unchanged", () => {
    expect(getPaginationRedirectPage(3, 3)).toBeNull();
    expect(getPaginationRedirectPage(1, 0)).toBeNull();
  });
});
