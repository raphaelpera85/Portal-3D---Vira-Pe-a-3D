import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseAdminClient: vi.fn(), requestMelhorEnvio: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/melhor-envio.server", () => ({ requestMelhorEnvio: mocks.requestMelhorEnvio }));
vi.mock("@/lib/melhor-envio", () => ({
  aggregateMelhorEnvioShipmentStatus: (statuses: string[], current: string) => statuses.every((status) => status === "carted") ? "carted" : current,
  groupMelhorEnvioPackages: (_service: number, _name: string, packages: unknown[]) => [packages],
  normalizeMelhorEnvioCartOrder: (payload: any, expectedId: string) => payload?.data?.id === expectedId && Number.isFinite(Number(payload.data.price))
    ? { shippingCostCents: Math.round(Number(payload.data.price) * 100) } : null,
  normalizeMelhorEnvioPackages: (packages: unknown) => Array.isArray(packages) ? packages : null,
  parseMelhorEnvioShipmentTag: (value: unknown) => typeof value === "string" && value.startsWith(`${targetId}-`)
    ? { targetId, packageIndex: Number(value.slice(targetId.length + 1)) } : null,
}));

import { POST } from "./route";

const targetId = "9f9ca418-77f7-4a4c-a4f8-8f746386a9ab";
const label = {
  id: "label-1", order_id: targetId, custom_print_request_id: null, store_id: "store-1",
  status: "cart_partial_uncertain", tracking_code: null, package_count: 1, provider_order_id: null, shipping_cost_cents: null,
};

function makeWebhookRequest(data: Record<string, unknown>, signature = true) {
  const body = JSON.stringify({ event: "order.created", data });
  const hmac = createHmac("sha256", "melhor-envio-test-secret").update(body).digest("base64");
  return new Request("https://portal.example/api/shipping/melhor-envio/webhook", {
    method: "POST", headers: { "content-type": "application/json", "x-me-signature": signature ? hmac : `${"A".repeat(43)}=` }, body,
  });
}

function makeAdmin(providerUserId = "seller-provider-1") {
  const inserts: unknown[] = [];
  const labelUpdates: Record<string, unknown>[] = [];
  const admin = {
    from: vi.fn((table: string) => {
      let operation = "select";
      let columns = "";
      let values: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      const query: Record<string, (...args: any[]) => any> = {};
      query.select = (selection: string) => { columns = selection; return query; };
      query.eq = (column: string, value: unknown) => { filters[column] = value; return query; };
      query.in = (column: string, value: unknown) => { filters[column] = value; return query; };
      query.order = () => query;
      query.insert = (row: Record<string, unknown>) => { operation = "insert"; values = row; return query; };
      query.update = (row: Record<string, unknown>) => { operation = "update"; values = row; return query; };
      const result = () => {
        if (table === "seller_order_shipping_label_packages" && operation === "insert") {
          inserts.push(values);
          return { data: { id: "package-row-1", label_id: label.id, status: "carted", tracking_code: null }, error: null };
        }
        if (table === "seller_order_shipping_label_packages" && operation === "update") return { data: null, error: null };
        if (table === "seller_order_shipping_label_packages" && filters.provider_order_id) return { data: null, error: null };
        if (table === "seller_order_shipping_label_packages" && filters.label_id) return { data: [
          { status: "carted", tracking_code: null, tracking_url: null, provider_status: "pending", shipping_cost_cents: 1525, provider_order_id: "provider-order-1" },
        ], error: null };
        if (table === "seller_order_shipping_labels" && operation === "update") { labelUpdates.push(values); return { data: null, error: null }; }
        if (table === "seller_order_shipping_labels" && filters.order_id === targetId) return { data: label, error: null };
        if (table === "seller_order_shipping_labels" && filters.id === label.id) return { data: label, error: null };
        if (table === "seller_order_shipping_labels") return { data: null, error: null };
        if (table === "store_melhor_envio_connections") return { data: { provider_user_id: providerUserId }, error: null };
        if (table === "seller_purchase_orders" && columns.includes("shipping_quote_packages")) return { data: {
          shipping_provider_service_id: 3, shipping_service: "Jadlog · Package", shipping_quote_packages: [
            { height: 10, width: 12, length: 15, weight: 0.5 },
          ],
        }, error: null };
        if (table === "seller_purchase_orders") return { data: {
          shipment_status: "awaiting_shipment", shipping_tracking_code: null, shipping_tracking_url: null,
          shipping_shipped_at: null, shipping_delivered_at: null,
        }, error: null };
        return { data: null, error: null };
      };
      query.maybeSingle = async () => result();
      query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
      return query;
    }),
  };
  return { admin, inserts, labelUpdates };
}

describe("Mejor Envio webhook shipment recovery", () => {
  beforeEach(() => {
    vi.stubEnv("ME_CLIENT_SECRET", "melhor-envio-test-secret");
    mocks.createSupabaseAdminClient.mockReset();
    mocks.requestMelhorEnvio.mockReset().mockResolvedValue({ data: { id: "provider-order-1", price: "15.25" } });
  });

  it("rejects an invalid signature before reading or changing the database", async () => {
    const { admin } = makeAdmin();
    mocks.createSupabaseAdminClient.mockReturnValue(admin);

    const response = await POST(makeWebhookRequest({ id: "provider-order-1", user_id: "seller-provider-1", status: "pending" }, false));

    expect(response.status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("recovers an orphaned cart label only after checking the seller and provider order", async () => {
    const { admin, inserts, labelUpdates } = makeAdmin();
    mocks.createSupabaseAdminClient.mockReturnValue(admin);

    const response = await POST(makeWebhookRequest({
      id: "provider-order-1", user_id: "seller-provider-1", status: "pending", tags: [{ tag: `${targetId}-1`, url: null }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.requestMelhorEnvio).toHaveBeenCalledWith("store-1", ["cart-read"], "/api/v2/me/cart/provider-order-1", undefined, "GET");
    expect(inserts).toEqual([expect.objectContaining({
      label_id: label.id, package_index: 1, provider_order_id: "provider-order-1", shipping_cost_cents: 1525,
    })]);
    expect(labelUpdates.at(-1)).toMatchObject({ status: "carted", shipping_cost_cents: 1525, provider_order_id: "provider-order-1" });
  });

  it("does not adopt a provider order from a different seller account", async () => {
    const { admin, inserts } = makeAdmin("expected-seller");
    mocks.createSupabaseAdminClient.mockReturnValue(admin);

    const response = await POST(makeWebhookRequest({
      id: "provider-order-1", user_id: "another-seller", status: "pending", tags: [{ tag: `${targetId}-1`, url: null }],
    }));

    expect(response.status).toBe(401);
    expect(inserts).toHaveLength(0);
    expect(mocks.requestMelhorEnvio).not.toHaveBeenCalled();
  });

  it("does not persist a webhook ID that the seller's cart endpoint cannot confirm", async () => {
    const { admin, inserts, labelUpdates } = makeAdmin();
    mocks.createSupabaseAdminClient.mockReturnValue(admin);
    mocks.requestMelhorEnvio.mockResolvedValue({ data: { id: "different-provider-order", price: "15.25" } });

    const response = await POST(makeWebhookRequest({
      id: "provider-order-1", user_id: "seller-provider-1", status: "pending", tags: [{ tag: `${targetId}-1`, url: null }],
    }));

    expect(response.status).toBe(503);
    expect(inserts).toHaveLength(0);
    expect(labelUpdates).toHaveLength(0);
  });
});
