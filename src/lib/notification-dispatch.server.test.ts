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

const adminClient = (rpc: ReturnType<typeof vi.fn>, pendingCount: number, staleCount = 0) => {
  const pendingQuery = { lt: vi.fn(), eq: vi.fn(), lte: vi.fn().mockResolvedValue({ count: pendingCount, error: null }) };
  const staleQuery = { lt: vi.fn(), eq: vi.fn() };
  pendingQuery.lt.mockReturnValue(pendingQuery);
  pendingQuery.eq.mockReturnValue(pendingQuery);
  staleQuery.lt.mockReturnValueOnce(staleQuery).mockResolvedValueOnce({ count: staleCount, error: null });
  staleQuery.eq.mockReturnValue(staleQuery);
  let queueQueryIndex = 0;
  return {
    rpc,
    pendingQuery,
    staleQuery,
    from: vi.fn(() => ({ select: vi.fn(() => queueQueryIndex++ === 0 ? pendingQuery : staleQuery) })),
  };
};

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

  it.each([
    { queueLength: 100, pendingCount: 0, status: 200, hasMore: false },
    { queueLength: 101, pendingCount: 1, status: 202, hasMore: true },
    { queueLength: 100, pendingCount: 0, staleCount: 1, status: 202, hasMore: true },
  ])("drains 100 notifications and reports whether queue has overflow", async ({ queueLength, pendingCount, staleCount = 0, status, hasMore }) => {
    const deliveries = Array.from({ length: queueLength }, (_, index) => ({
      id: `delivery-${index + 1}`, channel: "email", destination: `maker${index + 1}@example.com`,
      payload: { notification_type: "purchase", product_name: "Peça" }, attempts: 1,
    }));
    let offset = 0;
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_store_notification_deliveries") {
        const batch = deliveries.slice(offset, offset + 25);
        offset += 25;
        return { data: batch, error: null };
      }
      return { data: null, error: null };
    });
    const client = adminClient(rpc, pendingCount, staleCount);
    mocks.createSupabaseAdminClient.mockReturnValue(client);

    await expect(dispatchNotificationQueue()).resolves.toMatchObject({
      status,
      body: { processed: 100, sent: 100, failed: 0, deferred: 0, hasMore },
    });
    expect(rpc.mock.calls.filter(([name]) => name === "claim_store_notification_deliveries")).toHaveLength(4);
    expect(client.pendingQuery.lt).toHaveBeenCalledWith("attempts", 5);
    expect(client.pendingQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(client.staleQuery.lt).toHaveBeenCalledWith("updated_at", expect.any(String));
    expect(client.staleQuery.eq).toHaveBeenCalledWith("status", "sending");
    expect(offset).toBe(100);
    expect(mocks.sendNotificationDelivery).toHaveBeenCalledTimes(100);
  });

  it("returns completed batch counts when a later queue claim fails", async () => {
    const deliveries = Array.from({ length: 25 }, (_, index) => ({
      id: `delivery-${index + 1}`, channel: "email", destination: `maker${index + 1}@example.com`,
      payload: { notification_type: "purchase", product_name: "Peça" }, attempts: 1,
    }));
    const rpc = vi.fn(async (name: string) => {
      if (name !== "claim_store_notification_deliveries") return { data: null, error: null };
      return rpc.mock.calls.filter(([calledName]) => calledName === name).length === 1
        ? { data: deliveries, error: null }
        : { data: null, error: { message: "database unavailable" } };
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc });

    await expect(dispatchNotificationQueue()).resolves.toEqual({
      status: 503,
      body: { error: "notification_queue_unavailable", processed: 25, sent: 25, failed: 0, deferred: 0 },
    });
  });
});
