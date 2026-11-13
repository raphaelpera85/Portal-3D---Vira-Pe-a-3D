import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function bootstrapFirstAdmin(supabase, requestedEmail) {
  const email = typeof requestedEmail === "string" ? requestedEmail.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Provide a valid email address.");

  const { data: admins, error: adminError } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1);
  if (adminError) throw new Error("Could not check existing administrators.");
  if (admins?.length) throw new Error("An administrator already exists; this bootstrap is only for the first one.");

  let account;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Could not list Supabase Auth users.");
    const users = data?.users ?? [];
    account = users.find((user) => user.email?.toLowerCase() === email);
    if (account || users.length < 1000) break;
  }
  if (!account) throw new Error("No Supabase Auth account matches this email; sign up through the portal first.");
  if (!account.email_confirmed_at) throw new Error("Confirm this account's email first.");

  const { error: grantError } = await supabase.from("user_roles").insert({ user_id: account.id, role: "admin" });
  if (grantError) throw new Error("Could not assign the administrator role.");
  return { userId: account.id, email };
}

async function main() {
  const email = process.argv[2];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and a server-only Supabase secret in .env.local.");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await bootstrapFirstAdmin(supabase, email);
  console.info(`Administrator role assigned to ${result.email}.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Administrator bootstrap failed.");
    process.exitCode = 1;
  });
}
