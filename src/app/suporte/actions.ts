"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getUserWithRole } from "@/lib/auth-role.server";
import { dispatchNotificationQueue } from "@/lib/notification-dispatch.server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = new Set(["account", "product", "order", "payment", "delivery", "technical", "other"]);
const statuses = new Set(["open", "in_progress", "waiting_user", "resolved", "closed"]);

export async function createSupportTicketAction(formData: FormData): Promise<void> {
  const category = formData.get("category");
  const subject = formData.get("subject");
  const message = formData.get("message");
  if (typeof category !== "string" || !categories.has(category) || typeof subject !== "string" || subject.trim().length < 3 || subject.trim().length > 120 || typeof message !== "string" || message.trim().length < 1 || message.trim().length > 5000) redirect("/suporte?resultado=erro");

  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user) redirect("/conta");
  const { error } = await actor.supabase.rpc("create_support_ticket", { p_category: category, p_subject: subject.trim(), p_message: message.trim() });
  if (error) redirect("/suporte?resultado=erro");
  revalidatePath("/suporte");
  revalidatePath("/admin");
  revalidatePath("/admin/atendimento");
  redirect("/suporte?resultado=criado");
}

export async function replySupportTicketAction(formData: FormData): Promise<void> {
  const ticketId = formData.get("ticketId");
  const message = formData.get("message");
  if (typeof ticketId !== "string" || !uuidPattern.test(ticketId) || typeof message !== "string" || message.trim().length < 1 || message.trim().length > 5000) redirect("/suporte?resultado=erro");

  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user) redirect("/conta");
  const { error } = await actor.supabase.rpc("reply_support_ticket", { p_ticket_id: ticketId, p_message: message.trim() });
  if (error) redirect("/suporte?resultado=erro");
  revalidatePath("/suporte");
  revalidatePath("/admin");
  revalidatePath("/admin/atendimento");
  redirect("/suporte?resultado=resposta-enviada");
}

export async function replyAdminSupportTicketAction(formData: FormData): Promise<void> {
  const ticketId = formData.get("ticketId");
  const message = formData.get("message");
  if (typeof ticketId !== "string" || !uuidPattern.test(ticketId) || typeof message !== "string" || message.trim().length < 1 || message.trim().length > 5000) redirect("/admin/atendimento?resultado=erro");

  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("reply_support_ticket", { p_ticket_id: ticketId, p_message: message.trim() });
  if (error) redirect("/admin/atendimento?resultado=erro");
  after(dispatchNotificationQueue);
  revalidatePath("/admin");
  revalidatePath("/admin/atendimento");
  revalidatePath("/suporte");
  redirect("/admin/atendimento?resultado=resposta-enviada");
}

export async function dispatchSupportReplyNotificationsAction(): Promise<void> {
  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) return;
  after(dispatchNotificationQueue);
}

export async function setSupportTicketStatusAction(formData: FormData): Promise<void> {
  const ticketId = formData.get("ticketId");
  const status = formData.get("status");
  if (typeof ticketId !== "string" || !uuidPattern.test(ticketId) || typeof status !== "string" || !statuses.has(status)) redirect("/admin/atendimento?resultado=erro");

  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const { error } = await actor.supabase.rpc("set_support_ticket_status", { p_ticket_id: ticketId, p_status: status });
  if (error) redirect("/admin/atendimento?resultado=erro");
  revalidatePath("/admin");
  revalidatePath("/admin/atendimento");
  revalidatePath("/suporte");
  redirect("/admin/atendimento?resultado=atualizado");
}
