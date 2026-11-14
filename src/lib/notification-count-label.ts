export function getUnreadNotificationLabel(count: number | null | undefined) {
  if (!count || count < 1) return "Notificações";
  return `Notificações · ${count} ${count === 1 ? "não lida" : "não lidas"}`;
}
