import { describe, expect, it } from "vitest";
import { filterAdminUserDirectory, parseAdminUserPage, type AdminDirectoryUser } from "./admin-user-directory";

const users: AdminDirectoryUser[] = [
  { id: "1", email: "maker@example.com", displayName: "João Maker", createdAt: "2026-11-01T00:00:00Z", emailConfirmedAt: null, roles: ["Fabricante"] },
  { id: "2", email: "admin@example.com", displayName: "Equipe", createdAt: "2026-11-02T00:00:00Z", emailConfirmedAt: "2026-11-02T01:00:00Z", roles: ["Administrador"] },
];

describe("admin user directory", () => {
  it("accepts only one positive integer page value", () => {
    expect(parseAdminUserPage("3")).toBe(3);
    expect(parseAdminUserPage("0")).toBe(1);
    expect(parseAdminUserPage("1.5")).toBe(1);
    expect(parseAdminUserPage(["2", "3"])).toBe(1);
  });

  it("filters the bounded page by email, display name, or role without changing the source rows", () => {
    expect(filterAdminUserDirectory(users, "JOAO").map(({ id }) => id)).toEqual(["1"]);
    expect(filterAdminUserDirectory(users, "admin@example").map(({ id }) => id)).toEqual(["2"]);
    expect(filterAdminUserDirectory(users, "Fabricante").map(({ id }) => id)).toEqual(["1"]);
    expect(users).toHaveLength(2);
  });
});
