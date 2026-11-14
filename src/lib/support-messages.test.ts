import { describe, expect, it, vi } from "vitest";
import { fetchAllSupportRows } from "./support-messages";

describe("fetchAllSupportRows", () => {
  it("loads every page, including the final partial page", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => index);
    const fetchPage = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));

    const result = await fetchAllSupportRows(fetchPage);

    expect(result.data).toEqual(rows);
    expect(fetchPage.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("returns an error instead of silently showing partial history", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, index) => index), error: null })
      .mockResolvedValueOnce({ data: null, error: "query failed" });

    const result = await fetchAllSupportRows(fetchPage);

    expect(result).toEqual({ data: null, error: "query failed" });
  });
});
