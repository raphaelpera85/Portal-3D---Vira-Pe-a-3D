export function uploadSupabaseFile({ bucket, path, file, accessToken, signedToken, onProgress }: {
  bucket: string;
  path: string;
  file: File;
  accessToken: string;
  signedToken?: string;
  onProgress: (loaded: number) => void;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return Promise.reject(new Error("storage_not_configured"));

  const objectPath = path.split("/").map(encodeURIComponent).join("/");
  const endpoint = signedToken
    ? `/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${objectPath}`
    : `/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`;
  const url = new URL(endpoint, supabaseUrl);
  if (signedToken) url.searchParams.set("token", signedToken);

  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(signedToken ? "PUT" : "POST", url.toString());
    request.setRequestHeader("apikey", supabaseKey);
    request.setRequestHeader("authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(event.loaded, file.size));
    };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("storage_upload_failed"));
    request.onerror = () => reject(new Error("storage_upload_failed"));
    request.onabort = () => reject(new Error("storage_upload_aborted"));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    request.send(body);
  });
}
