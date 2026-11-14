export function groupRowsByKey<T>(rows: T[], getKey: (row: T) => string | null) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    if (key === null) continue;
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }
  return grouped;
}
