import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "buyer" | "maker" | "designer" | "admin";

export async function getUserWithRole(role: AppRole) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null as User | null, authorized: false };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { supabase, user: null, authorized: false };
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", role).maybeSingle();
  return { supabase, user, authorized: Boolean(data) };
}
