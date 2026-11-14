import { describe, expect, it, vi } from "vitest";
import { fetchInChunks } from "./fetch-in-chunks";

describe("fetchInChunks", () => {
  it("keeps each query bounded and combines every result", async () => {
    const fetch = vi.fn((ids: string[]) => Promise.resolve({ data: ids, error: null }));
    const ids = Array.from({ length: 201 }, (_, index) => String(index));

    const result = await fetchInChunks(ids, fetch);

    expect(result).toEqual({ data: ids, error: null });
    expect(fetch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 1]);
  });

  it("returns an error instead of a partial result", async () => {
    const fetch = vi.fn((ids: string[]) => Promise.resolve(ids[0] === "100"
      ? { data: null, error: "read_failed" }
      : { data: ids, error: null }));

    const result = await fetchInChunks(Array.from({ length: 201 }, (_, index) => String(index)), fetch);

    expect(result).toEqual({ data: null, error: "read_failed" });
  });
});
