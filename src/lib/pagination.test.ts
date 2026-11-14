import { describe, expect, it } from "vitest";
import { getPaginationRedirectPage, parsePageNumber } from "./pagination";

describe("getPaginationRedirectPage", () => {
  it("redirects a page beyond the final result page", () => {
    expect(getPaginationRedirectPage(9, 3)).toBe(3);
  });

  it("keeps valid and empty-result pages unchanged", () => {
    expect(getPaginationRedirectPage(3, 3)).toBeNull();
    expect(getPaginationRedirectPage(1, 0)).toBeNull();
  });
});

describe("parsePageNumber", () => {
  it("accepts positive decimal pages through the configured limit", () => {
    expect(parsePageNumber("1")).toBe(1);
    expect(parsePageNumber("24")).toBe(24);
    expect(parsePageNumber("10000")).toBe(10000);
  });

  it("rejects missing, malformed, zero, and non-string values", () => {
    for (const value of [undefined, null, "", "0", "01", "-1", "1.5", "1e2", 2, [], {}]) {
      expect(parsePageNumber(value)).toBeNull();
    }
  });

  it("rejects unsafe and over-limit pages", () => {
    expect(parsePageNumber("10001")).toBeNull();
    expect(parsePageNumber("9007199254740992")).toBeNull();
  });
});
