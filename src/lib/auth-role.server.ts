import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "buyer" | "maker" | "designer" | "admin";

export async function getUserWithRole(role: AppRole | AppRole[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null as User | null, roles: [] as AppRole[], authorized: false };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { supabase, user: null, roles: [] as AppRole[], authorized: false };
  const requestedRoles = Array.isArray(role) ? role : [role];
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", requestedRoles);
  const roles = (data ?? []).map(({ role: userRole }) => userRole as AppRole);
  return { supabase, user, roles, authorized: roles.length > 0 };
}
