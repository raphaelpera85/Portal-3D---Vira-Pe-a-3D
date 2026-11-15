import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchNotificationQueue: vi.fn(),
  reconcilePendingSellerRefunds: vi.fn(),
  cleanupStaleChargebackEvidenceUploads: vi.fn(),
  cleanupStaleDesignerServiceDeliveryUploads: vi.fn(),
  cleanupStaleCreatorModelUploads: vi.fn(),
  runCatalogSourceCheck: vi.fn(),
  runCatalogModelDiscovery: vi.fn(),
}));

vi.mock("@/lib/notification-dispatch.server", () => ({ dispatchNotificationQueue: mocks.dispatchNotificationQueue }));
vi.mock("@/lib/seller-payment-reconciliation.server", () => ({ reconcilePendingSellerRefunds: mocks.reconcilePendingSellerRefunds }));
vi.mock("@/lib/chargeback-evidence-cleanup.server", () => ({ cleanupStaleChargebackEvidenceUploads: mocks.cleanupStaleChargebackEvidenceUploads }));
vi.mock("@/lib/designer-service-delivery-cleanup.server", () => ({ cleanupStaleDesignerServiceDeliveryUploads: mocks.cleanupStaleDesignerServiceDeliveryUploads }));
vi.mock("@/lib/creator-model-upload-cleanup.server", () => ({ cleanupStaleCreatorModelUploads: mocks.cleanupStaleCreatorModelUploads }));
vi.mock("@/lib/catalog-source-check.server", () => ({ runCatalogSourceCheck: mocks.runCatalogSourceCheck }));
vi.mock("@/lib/catalog-discovery.server", () => ({ runCatalogModelDiscovery: mocks.runCatalogModelDiscovery }));

import { GET, POST } from "./route";

describe("scheduled privileged work", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "scheduled-work-test-secret");
    mocks.dispatchNotificationQueue.mockReset().mockResolvedValue({ status: 200, body: { processed: 0 } });
    mocks.reconcilePendingSellerRefunds.mockReset().mockResolvedValue({ processed: 0 });
    mocks.cleanupStaleChargebackEvidenceUploads.mockReset().mockResolvedValue({ deleted: 0 });
    mocks.cleanupStaleDesignerServiceDeliveryUploads.mockReset().mockResolvedValue({ scanned: 0, removed: 0 });
    mocks.cleanupStaleCreatorModelUploads.mockReset().mockResolvedValue({ scanned: 0, removed: 0 });
    mocks.runCatalogSourceCheck.mockReset().mockResolvedValue({ ok: true, checked: 0 });
    mocks.runCatalogModelDiscovery.mockReset().mockResolvedValue({ ok: true, checked: 0, candidates: 0 });
  });

  it("rejects missing or incorrect bearer credentials before running privileged tasks", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const missingSecret = await GET(new Request("https://portal.example/api/notifications/dispatch", {
      headers: { authorization: "Bearer scheduled-work-test-secret" },
    }));

    vi.stubEnv("CRON_SECRET", "scheduled-work-test-secret");
    const wrongToken = await GET(new Request("https://portal.example/api/notifications/dispatch", {
      headers: { authorization: "Bearer wrong" },
    }));

    expect(missingSecret.status).toBe(401);
    expect(wrongToken.status).toBe(401);
    expect(await wrongToken.json()).toEqual({ error: "unauthorized" });
    expect(mocks.dispatchNotificationQueue).not.toHaveBeenCalled();
    expect(mocks.reconcilePendingSellerRefunds).not.toHaveBeenCalled();
    expect(mocks.cleanupStaleChargebackEvidenceUploads).not.toHaveBeenCalled();
    expect(mocks.cleanupStaleDesignerServiceDeliveryUploads).not.toHaveBeenCalled();
    expect(mocks.cleanupStaleCreatorModelUploads).not.toHaveBeenCalled();
    expect(mocks.runCatalogSourceCheck).not.toHaveBeenCalled();
    expect(mocks.runCatalogModelDiscovery).not.toHaveBeenCalled();
  });

  it("runs scheduled cleanup, source monitoring, and discovery only with the bearer secret", async () => {
    const response = await GET(new Request("https://portal.example/api/notifications/dispatch", {
      headers: { authorization: "Bearer scheduled-work-test-secret" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.dispatchNotificationQueue).toHaveBeenCalledOnce();
    expect(mocks.reconcilePendingSellerRefunds).toHaveBeenCalledOnce();
    expect(mocks.cleanupStaleChargebackEvidenceUploads).toHaveBeenCalledOnce();
    expect(mocks.cleanupStaleDesignerServiceDeliveryUploads).toHaveBeenCalledOnce();
    expect(mocks.cleanupStaleCreatorModelUploads).toHaveBeenCalledOnce();
    expect(mocks.runCatalogSourceCheck).toHaveBeenCalledOnce();
    expect(mocks.runCatalogModelDiscovery).toHaveBeenCalledOnce();
  });

  it("reports a failed discovery run to the scheduled-job monitor", async () => {
    mocks.runCatalogModelDiscovery.mockResolvedValueOnce({ ok: false, sourceFailures: 1 });
    const response = await GET(new Request("https://portal.example/api/notifications/dispatch", {
      headers: { authorization: "Bearer scheduled-work-test-secret" },
    }));
    expect(response.status).toBe(500);
  });

  it("allows only the bearer secret to run a queue continuation", async () => {
    const denied = await POST(new Request("https://portal.example/api/notifications/dispatch", { method: "POST" }));
    expect(denied.status).toBe(401);
    expect(mocks.dispatchNotificationQueue).not.toHaveBeenCalled();

    mocks.dispatchNotificationQueue.mockResolvedValueOnce({ status: 202, body: { processed: 100, hasMore: true } });
    const response = await POST(new Request("https://portal.example/api/notifications/dispatch", {
      method: "POST",
      headers: { authorization: "Bearer scheduled-work-test-secret" },
    }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ processed: 100, hasMore: true });
    expect(mocks.dispatchNotificationQueue).toHaveBeenCalledOnce();
    expect(mocks.reconcilePendingSellerRefunds).not.toHaveBeenCalled();
    expect(mocks.runCatalogSourceCheck).not.toHaveBeenCalled();
  });
});
