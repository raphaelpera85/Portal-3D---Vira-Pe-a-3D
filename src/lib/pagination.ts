// shortcut: cap at 10,000 pages; raise if one queue can exceed 240,000 rows.
export const maxPageNumber = 10000;

export function parsePageNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d{0,4}$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= maxPageNumber ? page : null;
}

export function getPaginationRedirectPage(requestedPage: number, totalPages: number): number | null {
  const lastPage = Math.max(1, totalPages);
  return requestedPage > lastPage ? lastPage : null;
}
