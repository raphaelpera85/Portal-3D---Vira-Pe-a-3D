import { describe, expect, it } from "vitest";
import { fetchAllPages, getPaginationRedirectPage, parsePageNumber } from "./pagination";

describe("fetchAllPages", () => {
  it("loads every row across database page limits", async () => {
    const source = Array.from({ length: 1001 }, (_, index) => index);
    const result = await fetchAllPages((from, to) => Promise.resolve({ data: source.slice(from, to + 1), error: null }));

    expect(result).toEqual({ data: source, error: null });
  });

  it("returns a query error instead of a partial collection", async () => {
    const result = await fetchAllPages<number, string>((from) => Promise.resolve(
      from === 0 ? { data: Array.from({ length: 1000 }, (_, index) => index), error: null } : { data: null, error: "read_failed" },
    ));

    expect(result).toEqual({ data: null, error: "read_failed" });
  });
});

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
