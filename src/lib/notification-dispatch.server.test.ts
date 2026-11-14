import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getSiteUrl: vi.fn(),
  getNotificationPanelPath: vi.fn(),
  isNotificationChannelConfigured: vi.fn(),
  sendNotificationDelivery: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: mocks.getSiteUrl }));
vi.mock("@/lib/notification-messages", () => ({ getNotificationPanelPath: mocks.getNotificationPanelPath }));
vi.mock("@/lib/notification-delivery", () => ({
  isNotificationChannelConfigured: mocks.isNotificationChannelConfigured,
  sendNotificationDelivery: mocks.sendNotificationDelivery,
}));

import { dispatchNotificationQueue } from "./notification-dispatch.server";

describe("notification dispatch consent checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSiteUrl.mockReturnValue("https://virapeca.example");
    mocks.getNotificationPanelPath.mockReturnValue("/painel/maker");
    mocks.isNotificationChannelConfigured.mockReturnValue(true);
    mocks.sendNotificationDelivery.mockResolvedValue({ ok: true, messageId: "wamid-1" });
  });

  it("does not send a WhatsApp delivery after consent is revoked", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_store_notification_deliveries") return { data: [{ id: "delivery-1", channel: "whatsapp", destination: "+5511999999999", payload: { request_type: "purchase", product_name: "Suporte", quantity: 1 }, attempts: 1 }], error: null };
      if (name === "authorize_store_notification_whatsapp_delivery") return { data: false, error: null };
      return { data: null, error: null };
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc });

    await expect(dispatchNotificationQueue()).resolves.toMatchObject({
      status: 200,
      body: { processed: 1, sent: 0, failed: 1, deferred: 0 },
    });

    expect(rpc).toHaveBeenCalledWith("authorize_store_notification_whatsapp_delivery", { delivery_id: "delivery-1" });
    expect(mocks.sendNotificationDelivery).not.toHaveBeenCalled();
  });

  it("fails closed when the consent check is unavailable", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_store_notification_deliveries") return { data: [{ id: "delivery-1", channel: "whatsapp", destination: "+5511999999999", payload: { request_type: "purchase", product_name: "Suporte", quantity: 1 }, attempts: 1 }], error: null };
      if (name === "authorize_store_notification_whatsapp_delivery") return { data: null, error: { message: "database unavailable" } };
      return { data: null, error: null };
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc });

    await expect(dispatchNotificationQueue()).resolves.toMatchObject({ body: { failed: 1, sent: 0 } });

    expect(rpc).toHaveBeenCalledWith("fail_store_notification_delivery", { delivery_id: "delivery-1", reason: "whatsapp_consent_check_failed" });
    expect(mocks.sendNotificationDelivery).not.toHaveBeenCalled();
  });
});
