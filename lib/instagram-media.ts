const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export const MAX_INSTAGRAM_VIDEO_BYTES = 128 * 1024 * 1024;
export const INSTAGRAM_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v"] as const;

export function instagramUploadPrefix(accountId: string) {
  return `instagram/${accountId}/`;
}

export function instagramUploadPath(accountId: string, filename: string) {
  const cleaned = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120) || "reel.mp4";
  return `${instagramUploadPrefix(accountId)}${Date.now()}-${cleaned}`;
}

export function isSupportedInstagramVideo(file: Pick<File, "size" | "type">) {
  return file.size > 0
    && file.size <= MAX_INSTAGRAM_VIDEO_BYTES
    && INSTAGRAM_VIDEO_TYPES.includes(file.type as (typeof INSTAGRAM_VIDEO_TYPES)[number]);
}

export function isOwnedInstagramBlobUrl(value: string, accountId: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname.endsWith(BLOB_HOST_SUFFIX)
      && decodeURIComponent(url.pathname).startsWith(`/${instagramUploadPrefix(accountId)}`);
  } catch {
    return false;
  }
}
