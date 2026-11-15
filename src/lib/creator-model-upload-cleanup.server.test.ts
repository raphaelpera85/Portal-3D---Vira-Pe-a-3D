import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), remove: vi.fn(), deleteRows: vi.fn(), createAdmin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));

import { cleanupStaleCreatorModelUploads } from "./creator-model-upload-cleanup.server";

describe("creator model upload cleanup", () => {
  beforeEach(() => {
    mocks.select.mockReset().mockResolvedValue({ data: [], error: null });
    mocks.remove.mockReset().mockResolvedValue({ error: null });
    mocks.deleteRows.mockReset().mockResolvedValue({ error: null });
    mocks.createAdmin.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ lt: vi.fn(() => ({ order: vi.fn(() => ({ limit: mocks.select })) })) })) })),
        delete: vi.fn(() => ({ in: vi.fn(() => ({ eq: mocks.deleteRows })) })),
      })),
      storage: { from: vi.fn(() => ({ remove: mocks.remove })) },
    });
  });

  it("removes an expired staged object before deleting its row", async () => {
    const user = "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7";
    const id = "4d06021fc27c";
    mocks.select.mockResolvedValue({ data: [{ id, submitted_by: user, storage_path: `${user}/${id}.3mf` }], error: null });

    expect(await cleanupStaleCreatorModelUploads()).toEqual({ scanned: 1, removed: 1 });
    expect(mocks.remove).toHaveBeenCalledWith([`${user}/${id}.3mf`]);
    expect(mocks.deleteRows).toHaveBeenCalledWith("review_status", "uploading");
  });

  it("keeps rows when storage deletion fails", async () => {
    mocks.select.mockResolvedValue({ data: [{ id: "4d06021fc27c", submitted_by: "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7", storage_path: "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7/4d06021fc27c.3mf" }], error: null });
    mocks.remove.mockResolvedValue({ error: new Error("storage failed") });

    expect(await cleanupStaleCreatorModelUploads()).toEqual({ scanned: 1, removed: 0, error: "storage_cleanup_failed" });
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });
});
