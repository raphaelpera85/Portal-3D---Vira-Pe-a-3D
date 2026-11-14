export function getPaginationRedirectPage(requestedPage: number, totalPages: number): number | null {
  const lastPage = Math.max(1, totalPages);
  return requestedPage > lastPage ? lastPage : null;
}
