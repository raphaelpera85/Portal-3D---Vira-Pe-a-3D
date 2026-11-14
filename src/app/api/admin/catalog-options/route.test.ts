import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserWithRole: vi.fn() }));
vi.mock("@/lib/auth-role.server", () => ({ getUserWithRole: mocks.getUserWithRole }));

import { GET } from "./route";

const excludedId = "123e4567-e89b-42d3-a456-426614174000";
const optionId = "223e4567-e89b-42d3-a456-426614174000";

describe("admin catalog category options", () => {
  beforeEach(() => mocks.getUserWithRole.mockReset());

  it("rejects invalid exclusion IDs before authentication or database access", async () => {
    const response = await GET(new Request("https://example.test/api?kind=category&excludeId=bad"));

    expect(response.status).toBe(400);
    expect(mocks.getUserWithRole).not.toHaveBeenCalled();
  });

  it("requires an authorized administrator before querying categories", async () => {
    mocks.getUserWithRole.mockResolvedValue({ supabase: null, authorized: false });

    const response = await GET(new Request("https://example.test/api?kind=category"));

    expect(response.status).toBe(401);
    expect(mocks.getUserWithRole).toHaveBeenCalledWith("admin");
  });

  it("searches active categories, excludes the edited category, and returns an uncached page", async () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "or", "neq", "order"]) builder[method] = vi.fn(() => builder);
    builder.range = vi.fn().mockResolvedValue({ data: [{ id: optionId, name: "Chaveiros", slug: "chaveiros" }], count: 73, error: null });
    const from = vi.fn(() => builder);
    mocks.getUserWithRole.mockResolvedValue({ supabase: { from }, authorized: true });

    const response = await GET(new Request(`https://example.test/api?kind=category&q=chaveiro&offset=50&excludeId=${excludedId}`));
    const body = await response.json();

    expect(from).toHaveBeenCalledWith("product_categories");
    expect(builder.select).toHaveBeenCalledWith("id, name, slug", { count: "exact" });
    expect(builder.eq).toHaveBeenCalledWith("active", true);
    expect(builder.or).toHaveBeenCalledWith("name.ilike.%chaveiro%,slug.ilike.%chaveiro%");
    expect(builder.neq).toHaveBeenCalledWith("id", excludedId);
    expect(builder.range).toHaveBeenCalledWith(50, 99);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ options: [{ id: optionId, label: "Chaveiros · /chaveiros" }], total: 73 });
    expect(body.options).not.toContainEqual(expect.objectContaining({ id: excludedId }));
  });
});
