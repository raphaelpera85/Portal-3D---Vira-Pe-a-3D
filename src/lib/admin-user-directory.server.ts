import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapAdminDirectoryUsers } from "@/lib/admin-user-directory";

export const adminUserDirectoryPageSize = 25;

export async function loadAdminUserDirectory(page: number) {
  const empty = { users: [], page, pageSize: adminUserDirectoryPageSize, total: 0, pages: 0, error: false };
  const admin = createSupabaseAdminClient();
  if (!admin) return { ...empty, error: true };
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: adminUserDirectoryPageSize });
  if (error) return { ...empty, error: true };
  const pages = Math.ceil(data.total / adminUserDirectoryPageSize);
  const lastPage = Math.max(1, pages);
  if (page > lastPage) return loadAdminUserDirectory(lastPage);
  const ids = data.users.map(({ id }) => id);
  if (!ids.length) return { ...empty, page: lastPage, total: data.total, pages };
  const [profiles, roles] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", ids),
    admin.from("user_roles").select("user_id, role").in("user_id", ids),
  ]);
  if (profiles.error || roles.error) return { ...empty, error: true };
  return {
    users: mapAdminDirectoryUsers(data.users, profiles.data ?? [], roles.data ?? []), page,
    pageSize: adminUserDirectoryPageSize, total: data.total, pages, error: false,
  };
}
