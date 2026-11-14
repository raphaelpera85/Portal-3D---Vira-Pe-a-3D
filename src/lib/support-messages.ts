const pageSize = 1000;

export function mapSupportAttachmentSignedUrls<T extends { storage_path: string; file_name: string }>(
  attachments: readonly T[],
  signedUrls: readonly { path: string | null; error: string | null; signedUrl: string | null }[],
) {
  const signedByPath = new Map(signedUrls.map((item) => [item.path, item]));
  let error = false;
  const data = attachments.map((attachment) => {
    const signed = signedByPath.get(attachment.storage_path);
    if (signed?.error || !signed?.signedUrl) {
      error = true;
      return { ...attachment, url: null };
    }
    const url = new URL(signed.signedUrl);
    url.searchParams.set("download", attachment.file_name);
    return { ...attachment, url: url.toString() };
  });
  return { data, error };
}

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
