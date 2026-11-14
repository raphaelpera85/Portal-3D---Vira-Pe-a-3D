export type AdminDirectoryUser = {
  id: string; email: string; displayName: string; createdAt: string; emailConfirmedAt: string | null; roles: string[];
};

const roleLabels: Record<string, string> = { buyer: "Comprador", maker: "Fabricante", designer: "Designer", admin: "Administrador" };
const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function parseAdminUserPage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function getAdminRoleLabel(role: string) { return roleLabels[role] ?? role; }

export function filterAdminUserDirectory(users: AdminDirectoryUser[], query: string) {
  const term = normalize(query.trim());
  return term ? users.filter((user) => normalize([user.email, user.displayName, ...user.roles.map(getAdminRoleLabel)].join(" ")).includes(term)) : users;
}

export function mapAdminDirectoryUsers(authUsers: Array<{ id: string; email?: string; created_at: string; email_confirmed_at?: string }>, profiles: Array<{ id: string; display_name: string | null }>, roles: Array<{ user_id: string; role: string }>): AdminDirectoryUser[] {
  const names = new Map(profiles.map(({ id, display_name }) => [id, display_name ?? ""]));
  const roleMap = new Map<string, string[]>();
  for (const { user_id, role } of roles) roleMap.set(user_id, [...(roleMap.get(user_id) ?? []), role]);
  return authUsers.map((user) => ({
    id: user.id, email: user.email ?? "", displayName: names.get(user.id) ?? "",
    createdAt: user.created_at, emailConfirmedAt: user.email_confirmed_at ?? null,
    roles: (roleMap.get(user.id) ?? []).sort(),
  }));
}
