export function prioritizeSupportTickets<T extends { status: string; created_at: string; updated_at: string }>(tickets: T[]) {
  const priority = (status: string) => status === "open" || status === "in_progress" ? 0 : status === "waiting_user" ? 1 : 2;
  return [...tickets].sort((left, right) => {
    const group = priority(left.status) - priority(right.status);
    if (group) return group;
    return priority(left.status) === 0
      ? Date.parse(left.created_at) - Date.parse(right.created_at)
      : Date.parse(right.updated_at) - Date.parse(left.updated_at);
  });
}
