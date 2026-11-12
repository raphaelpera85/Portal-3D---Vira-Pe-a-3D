import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserWithRole: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  insertStagingRows: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/mercado-pago-access-token.server", () => ({ getMercadoPagoSellerAccessToken: vi.fn() }));
vi.mock("@/lib/chargeback-evidence", () => ({
  validateChargebackEvidence: (files: Array<{ name: string; type: string; size: number }>) => files.some((file) => !/\.(jpe?g|png|pdf)$/i.test(file.name)) ? "unsupported" : null,
  isChargebackEvidencePath: (path: string, storeId: string, caseId: string) => path.startsWith(`${storeId}/${caseId}/`),
  isChargebackEvidenceBytes: vi.fn(),
  sanitizeChargebackEvidenceFilename: (name: string) => name,
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));

import { createChargebackEvidenceUploads } from "./evidence-actions";

const file = { name: "nota.pdf", type: "application/pdf", size: 100 };
const storeId = "dc4e58d6-c782-4dc5-83c1-68d08072224d";

function query(data: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return builder;
}

function configureAuthorizedMaker(documentationStatus = "pending") {
  const actorSupabase = {
    from: vi.fn((table: string) => query(table === "stores" ? { id: storeId } : { case_id: "123456789", documentation_status: documentationStatus })),
  };
  const admin = {
    storage: { from: vi.fn(() => ({ createSignedUploadUrl: mocks.createSignedUploadUrl, remove: vi.fn().mockResolvedValue({ error: null }) })) },
    from: vi.fn(() => ({ insert: mocks.insertStagingRows })),
  };
  mocks.getUserWithRole.mockResolvedValue({ supabase: actorSupabase, user: { id: "maker-user" }, authorized: true });
  mocks.createSupabaseAdminClient.mockReturnValue(admin);
}

describe("maker chargeback evidence uploads", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset();
    mocks.createSupabaseAdminClient.mockReset();
    mocks.createSignedUploadUrl.mockReset().mockResolvedValue({ data: { token: "temporary-upload-token" }, error: null });
    mocks.insertStagingRows.mockReset().mockResolvedValue({ error: null });
  });

  afterEach(() => vi.restoreAllMocks());

  it("rejects unsupported files before authenticating or signing an upload", async () => {
    const result = await createChargebackEvidenceUploads("123456789", [{ ...file, name: "script.html", type: "text/html" }]);
    expect(result.success).toBe(false);
    expect(mocks.getUserWithRole).not.toHaveBeenCalled();
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("does not create upload tokens for an unauthenticated or unauthorized user", async () => {
    mocks.getUserWithRole.mockResolvedValue({ supabase: null, user: null, authorized: false });
    const result = await createChargebackEvidenceUploads("123456789", [file]);
    expect(result.success).toBe(false);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("refuses evidence uploads after the provider status is no longer pending", async () => {
    configureAuthorizedMaker("review_pending");
    const result = await createChargebackEvidenceUploads("123456789", [file]);
    expect(result.success).toBe(false);
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
    expect(mocks.insertStagingRows).not.toHaveBeenCalled();
  });

  it("signs private paths scoped to the authenticated maker store and chargeback", async () => {
    configureAuthorizedMaker();
    const result = await createChargebackEvidenceUploads("123456789", [file]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.uploads).toHaveLength(1);
    expect(result.uploads[0]).toMatchObject({ name: file.name, type: file.type, size: file.size, token: "temporary-upload-token" });
    expect(result.uploads[0].path).toMatch(new RegExp(`^${storeId}/123456789/[0-9a-f-]{36}\\.pdf$`));
    expect(result.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.insertStagingRows).toHaveBeenCalledWith([{ object_path: result.uploads[0].path, case_id: "123456789", store_id: storeId,
      file_name: file.name, mime_type: file.type, file_size: file.size }]);
  });
});
