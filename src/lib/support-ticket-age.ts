export function formatSupportTicketAge(updatedAt: string, now = new Date()) {
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs)) return "indisponível";

  const minutes = Math.floor(Math.max(0, now.getTime() - updatedAtMs) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}
