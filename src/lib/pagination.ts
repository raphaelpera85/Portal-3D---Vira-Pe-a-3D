// shortcut: cap at 10,000 pages; raise if one queue can exceed 240,000 rows.
export const maxPageNumber = 10000;
const fetchPageSize = 1000;

export async function fetchAllPages<T, E>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += fetchPageSize) {
    const { data, error } = await fetchPage(from, from + fetchPageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < fetchPageSize) return { data: rows, error: null };
  }
}

export function parsePageNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d{0,4}$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= maxPageNumber ? page : null;
}

export function getPaginationRedirectPage(requestedPage: number, totalPages: number): number | null {
  const lastPage = Math.max(1, totalPages);
  return requestedPage > lastPage ? lastPage : null;
}
