import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), createAdmin: vi.fn(), rpc: vi.fn(), createSignedUploadUrl: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));

import { prepareBuyerModelUpload, releaseBuyerModelUploadReservation } from "./actions";

const buyerId = "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7";
const bundleId = "7a90f57e-fd2f-4b5e-9849-16dd914c9cb8";
const files = [{ name: "modelo.3mf", storage_name: "modelo.3mf", size: 1024 }];

function setup() {
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.createSignedUploadUrl.mockResolvedValue({ data: { token: "signed-token" }, error: null });
  mocks.getUserWithRole.mockResolvedValue({ supabase: { rpc: mocks.rpc }, user: { id: buyerId }, authorized: true });
  mocks.createAdmin.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUploadUrl: mocks.createSignedUploadUrl })) } });
}

describe("buyer private model upload actions", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset();
    mocks.createAdmin.mockReset();
    mocks.rpc.mockReset();
    mocks.createSignedUploadUrl.mockReset();
    setup();
  });

  it("reserves a validated bundle and returns only path-scoped upload tokens", async () => {
    const result = await prepareBuyerModelUpload(bundleId, "modelo.3mf", files);

    expect(mocks.rpc).toHaveBeenCalledWith("reserve_buyer_model_upload", {
      p_bundle_id: bundleId, p_model_name: "modelo.3mf", p_total_bytes: 1024, p_files: files,
    });
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith(`${buyerId}/${bundleId}/modelo.3mf`, { upsert: false });
    expect(result).toEqual({ success: true, uploads: [{ path: `${buyerId}/${bundleId}/modelo.3mf`, storageName: "modelo.3mf", token: "signed-token" }] });
  });

  it("rejects invalid manifests before reserving quota or generating tokens", async () => {
    const result = await prepareBuyerModelUpload(bundleId, "modelo.3mf", [{ ...files[0], storage_name: "../outro.3mf" }]);

    expect(result.success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("does not issue upload tokens when the database rejects the quota reservation", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("quota") });

    const result = await prepareBuyerModelUpload(bundleId, "modelo.3mf", files);

    expect(result.success).toBe(false);
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("releases failed reservations through the authenticated buyer session", async () => {
    await releaseBuyerModelUploadReservation(bundleId);

    expect(mocks.rpc).toHaveBeenCalledWith("release_buyer_model_upload_reservation", { p_bundle_id: bundleId });
  });
});
