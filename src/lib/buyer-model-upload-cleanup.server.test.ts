import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), mark: vi.fn(), remove: vi.fn(), purge: vi.fn(), createAdmin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));

import { cleanupStaleBuyerModelUploadReservations } from "./buyer-model-upload-cleanup.server";

const buyerId = "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7";
const bundleId = "7a90f57e-fd2f-4b5e-9849-16dd914c9cb8";

describe("buyer model reservation cleanup", () => {
  beforeEach(() => {
    mocks.select.mockReset().mockResolvedValue({ data: [], error: null });
    mocks.mark.mockReset().mockResolvedValue({ error: null });
    mocks.remove.mockReset().mockResolvedValue({ error: null });
    mocks.purge.mockReset().mockResolvedValue({ count: 0, error: null });
    mocks.createAdmin.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ in: vi.fn(() => ({ is: vi.fn(() => ({ lt: vi.fn(() => ({ order: vi.fn(() => ({ limit: mocks.select })) })) })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ is: mocks.mark })) })) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ lt: vi.fn(() => ({ not: mocks.purge })), not: vi.fn(() => ({ lt: mocks.purge })) })) })),
      })),
      storage: { from: vi.fn(() => ({ remove: mocks.remove })) },
    });
  });

  it("removes expired reservation objects before marking their rows reusable only after quota expiry", async () => {
    mocks.select.mockResolvedValue({ data: [{ buyer_id: buyerId, bundle_id: bundleId, files: [{ storage_name: "modelo.3mf" }] }], error: null });

    expect(await cleanupStaleBuyerModelUploadReservations()).toEqual({ scanned: 1, removed: 1, purgedReservations: 0 });
    expect(mocks.remove).toHaveBeenCalledWith([`${buyerId}/${bundleId}/modelo.3mf`]);
    expect(mocks.mark).toHaveBeenCalledWith("cleaned_at", null);
  });

  it("keeps reservation metadata when a stored path is invalid or storage cleanup fails", async () => {
    mocks.select.mockResolvedValue({ data: [{ buyer_id: buyerId, bundle_id: bundleId, files: [{ storage_name: "../private.3mf" }] }], error: null });
    expect(await cleanupStaleBuyerModelUploadReservations()).toMatchObject({ error: "invalid_reservation_path", removed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();

    mocks.select.mockResolvedValue({ data: [{ buyer_id: buyerId, bundle_id: bundleId, files: [{ storage_name: "modelo.3mf" }] }], error: null });
    mocks.remove.mockResolvedValue({ error: new Error("storage failed") });
    expect(await cleanupStaleBuyerModelUploadReservations()).toMatchObject({ error: "storage_cleanup_failed", removed: 0 });
    expect(mocks.mark).not.toHaveBeenCalled();
  });
});
