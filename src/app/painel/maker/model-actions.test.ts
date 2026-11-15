import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn(), createAdmin: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));

import { finalizeCreatorModelUpload, prepareCreatorModelUpload } from "./model-actions";

const userId = "8a90f57e-fd2f-4b5e-9849-16dd914c9cb7";
const form = { name: "Dragão articulado", categorySlug: "infantil", creatorName: "Raphael", tags: "dragão, articulado", sourceUrl: "", rightsConfirmed: "true" };

function setup(options: { storedSize?: number; row?: Record<string, unknown> } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "4d06021fc27c" }, error: null }) })) })) })) })) }));
  const selectedRow = options.row ?? { storage_path: `${userId}/4d06021fc27c.3mf`, file_name: "dragao.3mf", file_size_bytes: 1024, review_status: "uploading" };
  const admin = {
    from: vi.fn(() => ({
      insert,
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: selectedRow, error: null }) })) })) })),
      update,
    })),
    storage: { from: vi.fn(() => ({
      createSignedUploadUrl: vi.fn().mockResolvedValue({ data: { token: "signed-token" }, error: null }),
      info: vi.fn().mockResolvedValue({ data: { size: options.storedSize ?? 1024 }, error: null }),
    })) },
  };
  const actorSupabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "store-1", status: "published" } }) })) })) })) };
  mocks.getUserWithRole.mockResolvedValue({ supabase: actorSupabase, user: { id: userId }, authorized: true });
  mocks.createAdmin.mockReturnValue(admin);
  return { admin, insert, update, actorSupabase };
}

describe("maker creator model file actions", () => {
  beforeEach(() => {
    mocks.getUserWithRole.mockReset();
    mocks.createAdmin.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("creates a private staging row and returns a signed upload token", async () => {
    const { insert } = setup();

    const result = await prepareCreatorModelUpload(form, { name: "dragao.3mf", size: 1024, type: "application/octet-stream" });

    expect(result.success).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      store_id: "store-1", submitted_by: userId, review_status: "uploading", asset_path: null,
      storage_path: expect.stringMatching(new RegExp(`^${userId}/[a-f0-9]{12}\\.3mf$`)),
      file_name: "dragao.3mf", file_size_bytes: 1024,
    }));
  });

  it("rejects an invalid extension before accessing the account or storage", async () => {
    const result = await prepareCreatorModelUpload(form, { name: "modelo.stl", size: 1024 });

    expect(result).toMatchObject({ success: false });
    expect(mocks.getUserWithRole).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("does not queue an upload whose stored size differs from the submitted size", async () => {
    const { update } = setup({ storedSize: 1000 });

    const result = await finalizeCreatorModelUpload("4d06021fc27c");

    expect(result).toEqual({ success: false, message: "O arquivo não chegou completo ao armazenamento. Tente enviá-lo novamente." });
    expect(update).not.toHaveBeenCalled();
  });
});
