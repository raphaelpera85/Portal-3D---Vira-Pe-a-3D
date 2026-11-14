import { describe, expect, it, vi } from "vitest";
import { fetchAllSupportRows, mapSupportAttachmentSignedUrls } from "./support-messages";

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

describe("mapSupportAttachmentSignedUrls", () => {
  it("maps signed URLs and preserves each download filename", () => {
    const result = mapSupportAttachmentSignedUrls(
      [{ storage_path: "ticket-1/file-1.png", file_name: "Foto do modelo.png" }],
      [{ path: "ticket-1/file-1.png", error: null, signedUrl: "https://storage.example/file-1.png?token=abc" }],
    );

    expect(result.error).toBe(false);
    expect(result.data).toHaveLength(1);
    expect(new URL(result.data[0].url!).searchParams.get("download")).toBe("Foto do modelo.png");
    expect(new URL(result.data[0].url!).searchParams.get("token")).toBe("abc");
  });

  it("marks failed, empty, and missing per-item signed URLs", () => {
    const result = mapSupportAttachmentSignedUrls(
      [
        { storage_path: "ticket-1/failed.png", file_name: "failed.png" },
        { storage_path: "ticket-1/empty.png", file_name: "empty.png" },
        { storage_path: "ticket-1/missing.png", file_name: "missing.png" },
      ],
      [
        { path: "ticket-1/failed.png", error: "object missing", signedUrl: null },
        { path: "ticket-1/empty.png", error: null, signedUrl: null },
      ],
    );

    expect(result.error).toBe(true);
    expect(result.data.map(({ url }) => url)).toEqual([null, null, null]);
  });
});
