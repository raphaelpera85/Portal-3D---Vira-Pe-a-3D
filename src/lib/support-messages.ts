const pageSize = 1000;

export async function fetchAllSupportRows<T, E>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
) {
  const messages: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    messages.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: messages, error: null };
  }
}
