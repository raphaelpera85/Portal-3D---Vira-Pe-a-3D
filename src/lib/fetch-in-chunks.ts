const idBatchSize = 100;

export async function fetchInChunks<T, E>(
  ids: string[],
  fetchBatch: (ids: string[]) => PromiseLike<{ data: T[] | null; error: E | null }>,
) {
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += idBatchSize) {
    const { data, error } = await fetchBatch(ids.slice(start, start + idBatchSize));
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
  }
  return { data: rows, error: null };
}
