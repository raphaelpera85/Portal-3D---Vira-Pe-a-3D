import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchNotificationQueue: vi.fn(),
  reconcilePendingSellerRefunds: vi.fn(),
  cleanupStaleChargebackEvidenceUploads: vi.fn(),
  runCatalogSourceCheck: vi.fn(),
}));

vi.mock("@/lib/notification-dispatch.server", () => ({ dispatchNotificationQueue: mocks.dispatchNotificationQueue }));
vi.mock("@/lib/seller-payment-reconciliation.server", () => ({ reconcilePendingSellerRefunds: mocks.reconcilePendingSellerRefunds }));
vi.mock("@/lib/chargeback-evidence-cleanup.server", () => ({ cleanupStaleChargebackEvidenceUploads: mocks.cleanupStaleChargebackEvidenceUploads }));
vi.mock("@/lib/catalog-source-check.server", () => ({ runCatalogSourceCheck: mocks.runCatalogSourceCheck }));

import { GET } from "./route";

describe("scheduled privileged work", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "scheduled-work-test-secret");
    mocks.dispatchNotificationQueue.mockReset().mockResolvedValue({ status: 200, body: { processed: 0 } });
    mocks.reconcilePendingSellerRefunds.mockReset().mockResolvedValue({ processed: 0 });
    mocks.cleanupStaleChargebackEvidenceUploads.mockReset().mockResolvedValue({ deleted: 0 });
    mocks.runCatalogSourceCheck.mockReset().mockResolvedValue({ ok: true, checked: 0 });
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
    expect(mocks.runCatalogSourceCheck).not.toHaveBeenCalled();
  });

  it("runs the scheduled queue, reconciliation, cleanup, and source check only with the bearer secret", async () => {
    const response = await GET(new Request("https://portal.example/api/notifications/dispatch", {
      headers: { authorization: "Bearer scheduled-work-test-secret" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.dispatchNotificationQueue).toHaveBeenCalledOnce();
    expect(mocks.reconcilePendingSellerRefunds).toHaveBeenCalledOnce();
    expect(mocks.cleanupStaleChargebackEvidenceUploads).toHaveBeenCalledOnce();
    expect(mocks.runCatalogSourceCheck).toHaveBeenCalledOnce();
  });
});
