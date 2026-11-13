import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  storageRemove: vi.fn(),
  deleteRows: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));

import { cleanupStaleDesignerServiceDeliveryUploads } from "./designer-service-delivery-cleanup.server";

describe("designer service delivery cleanup", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.select.mockReset();
    mocks.storageRemove.mockReset().mockResolvedValue({ error: null });
    mocks.deleteRows.mockReset().mockResolvedValue({ error: null });
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          lt: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(() => mocks.select()) })) })),
        })),
        delete: vi.fn(() => ({ in: (...args: unknown[]) => mocks.deleteRows(...args) })),
      })),
      storage: { from: vi.fn(() => ({ remove: (...args: unknown[]) => mocks.storageRemove(...args) })) },
    });
    mocks.select.mockResolvedValue({ data: [], error: null });
  });

  it("removes only expired staged objects and then their metadata", async () => {
    const old = new Date(Date.now() - 27 * 60 * 60_000).toISOString();
    mocks.select.mockResolvedValue({ data: [{ storage_path: `8a90f57e-fd2f-4b5e-9849-16dd914c9cb7/4d06021f-c27c-43c9-a8f5-d421a48ed48e.3mf`, created_at: old }], error: null });

    const result = await cleanupStaleDesignerServiceDeliveryUploads();

    expect(result).toEqual({ scanned: 1, removed: 1 });
    expect(mocks.storageRemove).toHaveBeenCalledWith(["8a90f57e-fd2f-4b5e-9849-16dd914c9cb7/4d06021f-c27c-43c9-a8f5-d421a48ed48e.3mf"]);
    expect(mocks.deleteRows).toHaveBeenCalledWith("storage_path", ["8a90f57e-fd2f-4b5e-9849-16dd914c9cb7/4d06021f-c27c-43c9-a8f5-d421a48ed48e.3mf"]);
  });

  it("keeps staging records if object removal fails", async () => {
    mocks.select.mockResolvedValue({ data: [{ storage_path: "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7/4d06021f-c27c-43c9-a8f5-d421a48ed48e.3mf" }], error: null });
    mocks.storageRemove.mockResolvedValue({ error: new Error("storage unavailable") });

    const result = await cleanupStaleDesignerServiceDeliveryUploads();

    expect(result).toEqual({ scanned: 1, removed: 0, error: "storage_cleanup_failed" });
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });

  it("does not remove paths outside the staged model request structure", async () => {
    mocks.select.mockResolvedValue({ data: [{ storage_path: "../private/anything.3mf" }], error: null });

    const result = await cleanupStaleDesignerServiceDeliveryUploads();

    expect(result).toEqual({ scanned: 1, removed: 0, error: "invalid_staging_path" });
    expect(mocks.storageRemove).not.toHaveBeenCalled();
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });
});
