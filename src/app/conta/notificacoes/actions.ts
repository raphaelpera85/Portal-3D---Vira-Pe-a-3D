"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markUserNotificationRead(formData: FormData): Promise<void> {
  const notificationId = formData.get("notificationId");
  if (typeof notificationId !== "string" || !uuidPattern.test(notificationId)) redirect("/conta/notificacoes?resultado=erro");
  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("mark_user_notification_read", { p_notification_id: notificationId });
  if (error) redirect("/conta/notificacoes?resultado=erro");
  revalidatePath("/conta/notificacoes");
}
